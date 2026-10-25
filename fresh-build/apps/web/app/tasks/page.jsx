'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { parseINRToPaise } from '../../../../packages/api-client/index.js';
import { getBrowserClient } from '../../lib/supabase.js';

const creators = new Set(['president', 'vice_president', 'secretary']);
function CashCountForm({ taskId, busy, correction, onSubmit }) {
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const args = {
        p_task_id: taskId,
        p_date: date,
        p_amount_paise: parseINRToPaise(amount),
        p_evidence: evidence.trim(),
      };
      if (await onSubmit(args)) {
        setDate('');
        setAmount('');
        setEvidence('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <form onSubmit={submit}>
      <h4>
        {correction
          ? 'Submit corrected cash count'
          : 'Submit cash count for Treasurer verification'}
      </h4>
      <p className="muted">
        {correction
          ? 'Use a new numbered correction slip. The rejected slip remains in the audit trail.'
          : 'This records a pending count. It does not post income or issue a receipt.'}
      </p>
      <label className="field">
        Count date in India
        <input
          type="date"
          required
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label className="field">
        Claimed amount (₹)
        <input
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="field">
        Numbered cash slip or evidence reference
        <input
          required
          minLength={3}
          maxLength={240}
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {correction ? 'Submit corrected count' : 'Submit pending count'}
      </button>
    </form>
  );
}
export default function TasksPage() {
  const [role, setRole] = useState(null),
    [session, setSession] = useState('checking');
  const [tasks, setTasks] = useState([]),
    [cashTasks, setCashTasks] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(''),
    [description, setDescription] = useState('');
  const [cashCollection, setCashCollection] = useState(false);
  const [date, setDate] = useState(''),
    [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('open'),
    [total, setTotal] = useState(10);
  const [invitedCap, setInvitedCap] = useState(0),
    [volunteerCap, setVolunteerCap] = useState(10);
  const [participants, setParticipants] = useState({}),
    [invitee, setInvitee] = useState('');
  const [reviewReason, setReviewReason] = useState(''),
    [cancelReason, setCancelReason] = useState('');
  const operations = useRef(new Map());
  async function rpc(name, args) {
    const { data, error } = await getBrowserClient().rpc(name, args);
    if (error) throw new Error(error.message || 'Action unavailable');
    return data;
  }
  async function load() {
    const [nextRole, items, collections] = await Promise.all([
      rpc('current_app_role', {}),
      rpc('list_visible_work_tasks', {}),
      rpc('list_cash_collection_workflow', {}),
    ]);
    setRole(nextRole);
    setTasks(items ?? []);
    setCashTasks(collections ?? []);
  }
  useEffect(() => {
    let active = true;
    getBrowserClient()
      .auth.getUser()
      .then(async ({ data, error: authError }) => {
        if (!active) return;
        if (authError || !data?.user) {
          setSession('signed-out');
          return;
        }
        try {
          await load();
          if (active) setSession('ready');
        } catch (cause) {
          if (active) setError(cause.message);
        }
      })
      .catch(() => {
        if (active) setSession('signed-out');
      });
    return () => {
      active = false;
    };
  }, []);
  async function command(name, args, key) {
    setBusy(true);
    setError('');
    const id = operations.current.get(key) ?? crypto.randomUUID();
    operations.current.set(key, id);
    try {
      await rpc(name, { ...args, p_operation_id: id });
      operations.current.delete(key);
      await load();
      return true;
    } catch (cause) {
      setError(cause.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(event) {
    event.preventDefault();
    if (total > invitedCap + volunteerCap) {
      setError('Total places cannot exceed invited and volunteer places together.');
      return;
    }
    const args = {
      p_title: title.trim(),
      p_description: description.trim(),
      p_date: date || null,
      p_location: location.trim() || null,
      p_mode: mode,
      p_total: Number(total),
      p_invited: Number(invitedCap),
      p_volunteer: Number(volunteerCap),
    };
    const name = cashCollection ? 'create_cash_collection_task' : 'create_work_task';
    if (await command(name, args, `create:${name}:${JSON.stringify(args)}`)) {
      setTitle('');
      setDescription('');
      setDate('');
      setLocation('');
      setCashCollection(false);
    }
  }
  async function showParticipants(id) {
    try {
      const list = await rpc('list_work_task_participants', { p_task_id: id });
      setParticipants({ ...participants, [id]: list ?? [] });
      setError('');
    } catch (cause) {
      setError(cause.message);
    }
  }
  const cashByTask = new Map(cashTasks.map((task) => [task.task_id, task]));
  return (
    <main className="management">
      <Link href="/">← Masjid E Mamoor 2</Link>
      <h1>Work tasks</h1>
      {session === 'checking' && <p>Checking your account…</p>}
      {session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to see tasks.
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {session === 'ready' && (
        <>
          {creators.has(role) && (
            <form className="panel" onSubmit={create}>
              <h2>Create an open task</h2>
              <label className="field">
                <input
                  type="checkbox"
                  checked={cashCollection}
                  onChange={(event) => setCashCollection(event.target.checked)}
                />
                Cash collection task (requires a pending count and Treasurer verification)
              </label>
              <label className="field">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={160}
                />
              </label>
              <label className="field">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  maxLength={2000}
                />
              </label>
              <label className="field">
                Date (optional)
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field">
                Location (optional)
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={240}
                />
              </label>
              <label className="field">
                Participation
                <select
                  value={mode}
                  onChange={(e) => {
                    const next = e.target.value;
                    setMode(next);
                    if (next === 'direct') {
                      setInvitedCap(10);
                      setVolunteerCap(0);
                    }
                    if (next === 'open') {
                      setInvitedCap(0);
                      setVolunteerCap(10);
                    }
                    if (next === 'mixed') {
                      setInvitedCap(5);
                      setVolunteerCap(5);
                    }
                  }}
                >
                  <option value="open">Open</option>
                  <option value="direct">By invitation</option>
                  <option value="mixed">Invited and open</option>
                </select>
              </label>
              <label className="field">
                Total places
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={total}
                  onChange={(e) => setTotal(Number(e.target.value))}
                />
              </label>
              {mode !== 'open' && (
                <label className="field">
                  Invited places
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={invitedCap}
                    onChange={(e) => setInvitedCap(Number(e.target.value))}
                  />
                </label>
              )}
              {mode !== 'direct' && (
                <label className="field">
                  Volunteer places
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={volunteerCap}
                    onChange={(e) => setVolunteerCap(Number(e.target.value))}
                  />
                </label>
              )}
              <button className="primary" disabled={busy}>
                Create task
              </button>
            </form>
          )}
          <section className="panel">
            <h2>Visible tasks</h2>
            {tasks.length === 0 ? (
              <p>No tasks yet.</p>
            ) : (
              tasks.map((task) => (
                <article key={task.task_id} className="panel">
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                  <p className="muted">
                    {task.status} · {task.confirmed_count}/{task.total_cap} places
                    {task.scheduled_date ? ` · ${task.scheduled_date}` : ''}
                  </p>
                  <p>My status: {task.my_status ?? 'Not joined'}</p>
                  {cashByTask.has(task.task_id) && (
                    <>
                      <p>
                        <strong>Cash collection task</strong> · Count:{' '}
                        {cashByTask.get(task.task_id).count_status ?? 'not submitted'}
                      </p>
                      {cashByTask.get(task.task_id).count_id && (
                        <p className="muted">
                          Slip: {cashByTask.get(task.task_id).evidence_reference}
                          {' · '}Claimed: {cashByTask.get(task.task_id).claimed_amount_paise} paise
                          {cashByTask.get(task.task_id).actual_amount_paise &&
                            ` · Verified: ${cashByTask.get(task.task_id).actual_amount_paise} paise`}
                        </p>
                      )}
                      {cashByTask.get(task.task_id).count_status === 'rejected' &&
                        cashByTask.get(task.task_id).rejection_reason && (
                          <p role="status" className="notice">
                            Treasurer rejected the count:{' '}
                            {cashByTask.get(task.task_id).rejection_reason}
                          </p>
                        )}
                      {task.status === 'active' &&
                        role !== 'treasurer' &&
                        [null, 'rejected'].includes(cashByTask.get(task.task_id).count_status) &&
                        ['confirmed', 'completion_submitted', 'returned', 'verified'].includes(
                          task.my_status,
                        ) && (
                          <CashCountForm
                            taskId={task.task_id}
                            busy={busy}
                            correction={cashByTask.get(task.task_id).count_status === 'rejected'}
                            onSubmit={(args) =>
                              command(
                                'submit_cash_task_count',
                                args,
                                `cash-count:${JSON.stringify(args)}`,
                              )
                            }
                          />
                        )}
                    </>
                  )}
                  {task.status === 'active' &&
                    (!task.my_status || task.my_status === 'invited') && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          command(
                            'join_work_task',
                            { p_task_id: task.task_id },
                            `join:${task.task_id}`,
                          )
                        }
                      >
                        {task.my_status === 'invited' ? 'Accept invitation' : 'Join or waitlist'}
                      </button>
                    )}
                  {task.status === 'active' &&
                    ['confirmed', 'returned'].includes(task.my_status) && (
                      <>
                        <label className="field">
                          Completion note
                          <input value={note} onChange={(e) => setNote(e.target.value)} />
                        </label>
                        <button
                          disabled={busy}
                          onClick={() =>
                            command(
                              'submit_work_task_completion',
                              {
                                p_task_id: task.task_id,
                                p_note: note || null,
                              },
                              `complete:${task.task_id}:${note}`,
                            )
                          }
                        >
                          Submit completion
                        </button>
                      </>
                    )}
                  {task.status === 'active' &&
                    ['confirmed', 'waitlisted', 'invited'].includes(task.my_status) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          command(
                            'leave_work_task',
                            {
                              p_task_id: task.task_id,
                            },
                            `leave:${task.task_id}`,
                          )
                        }
                      >
                        {task.my_status === 'invited' ? 'Decline invitation' : 'Leave'}
                      </button>
                    )}
                  {task.is_creator && (
                    <>
                      <button disabled={busy} onClick={() => showParticipants(task.task_id)}>
                        Review participants
                      </button>
                      {participants[task.task_id] && (
                        <ul>
                          {participants[task.task_id].map((person) => (
                            <li key={person.member_id}>
                              {person.member_id} · {person.source} · {person.status}
                              {person.completion_note && ` · ${person.completion_note}`}
                              {person.status === 'completion_submitted' &&
                                task.status === 'active' && (
                                  <>
                                    <button
                                      disabled={busy}
                                      onClick={async () => {
                                        if (
                                          await command(
                                            'review_work_task_completion',
                                            {
                                              p_task_id: task.task_id,
                                              p_member_id: person.member_id,
                                              p_decision: 'accept',
                                              p_reason: null,
                                            },
                                            `accept:${task.task_id}:${person.member_id}`,
                                          )
                                        )
                                          await showParticipants(task.task_id);
                                      }}
                                    >
                                      Accept completion
                                    </button>
                                    <button
                                      disabled={busy || reviewReason.trim().length < 3}
                                      onClick={async () => {
                                        if (
                                          await command(
                                            'review_work_task_completion',
                                            {
                                              p_task_id: task.task_id,
                                              p_member_id: person.member_id,
                                              p_decision: 'return',
                                              p_reason: reviewReason.trim(),
                                            },
                                            `return:${task.task_id}:${person.member_id}:${reviewReason}`,
                                          )
                                        )
                                          await showParticipants(task.task_id);
                                      }}
                                    >
                                      Return for changes
                                    </button>
                                  </>
                                )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {task.status === 'active' && (
                        <>
                          <label className="field">
                            Invite member account ID
                            <input value={invitee} onChange={(e) => setInvitee(e.target.value)} />
                          </label>
                          <button
                            disabled={busy || !invitee}
                            onClick={async () => {
                              if (
                                await command(
                                  'invite_work_task_member',
                                  { p_task_id: task.task_id, p_member_id: invitee },
                                  `invite:${task.task_id}:${invitee}`,
                                )
                              )
                                await showParticipants(task.task_id);
                            }}
                          >
                            Invite member
                          </button>
                          <label className="field">
                            Review return reason
                            <input
                              maxLength={500}
                              value={reviewReason}
                              onChange={(e) => setReviewReason(e.target.value)}
                            />
                          </label>
                          <label className="field">
                            Cancellation reason
                            <input
                              maxLength={500}
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                            />
                          </label>
                          <button
                            disabled={busy || cancelReason.trim().length < 3}
                            onClick={() =>
                              command(
                                'cancel_work_task',
                                {
                                  p_task_id: task.task_id,
                                  p_reason: cancelReason.trim(),
                                },
                                `cancel:${task.task_id}:${cancelReason}`,
                              )
                            }
                          >
                            Cancel task
                          </button>
                        </>
                      )}
                    </>
                  )}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
