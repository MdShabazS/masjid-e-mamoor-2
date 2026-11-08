'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buildMeetingArgs } from '../../../../packages/api-client/meeting-input.js';
import { getBrowserClient } from '../../lib/supabase.js';
import { MemberSelect } from '../../lib/management.js';
import { FinalizationFallback, MasjidSiteSetting, MeetingAttendance } from './attendance.jsx';

const LOCATION_FIELDS = new Set([
  'p_latitude',
  'p_longitude',
  'p_accuracy_m',
  'p_captured_at',
  'p_mocked',
]);

const editors = new Set(['president', 'vice_president', 'secretary', 'data_entry']);
export default function MeetingsPage() {
  const [session, setSession] = useState('checking'),
    [role, setRole] = useState(null);
  const [meetings, setMeetings] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(''),
    [description, setDescription] = useState('');
  const [date, setDate] = useState(''),
    [time, setTime] = useState(''),
    [location, setLocation] = useState('');
  const [invitees, setInvitees] = useState({});
  const [declineReasons, setDeclineReasons] = useState({});
  const [cancelReasons, setCancelReasons] = useState({});
  const [attendance, setAttendance] = useState({});
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const operations = useRef(new Map());
  async function rpc(name, args) {
    const { data, error } = await getBrowserClient().rpc(name, args);
    if (error) throw new Error(error.message || 'Action unavailable');
    return data;
  }
  async function load() {
    const [currentRole, list, mine] = await Promise.all([
      rpc('current_app_role', {}),
      rpc('list_visible_committee_meetings', {}),
      rpc('my_committee_attendance', {}),
    ]);
    setRole(currentRole);
    setMeetings(list ?? []);
    setAttendance(Object.fromEntries((mine ?? []).map((row) => [row.meeting_id, row])));
    setVersion((current) => current + 1);
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
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
      return false;
    }
    try {
      await load();
    } catch {
      setError(
        'Action saved, but the meeting list could not refresh. Reload before another action.',
      );
    }
    setBusy(false);
    return true;
  }
  /** Attendance commands keep one retry ID per action; a fresh location reading does not change it. */
  async function runAttendance(name, args, success) {
    setNotice('');
    const stable = Object.fromEntries(
      Object.entries(args).filter(([field]) => !LOCATION_FIELDS.has(field)),
    );
    const saved = await command(name, args, `${name}:${JSON.stringify(stable)}`);
    if (saved) setNotice(success);
    return saved;
  }
  async function create(event) {
    event.preventDefault();
    setError('');
    try {
      const args = buildMeetingArgs({ title, description, date, time, location });
      if (await command('create_committee_meeting', args, `create:${JSON.stringify(args)}`)) {
        setTitle('');
        setDescription('');
        setDate('');
        setTime('');
        setLocation('');
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <main className="management">
      <Link href="/">← Masjid E Mamoor 2</Link>
      <h1>Committee meetings</h1>
      {session === 'checking' && <p>Checking your account…</p>}
      {session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to see meetings.
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {session === 'ready' && (
        <>
          {role === 'system_admin' && (
            <MasjidSiteSetting
              busy={busy}
              run={runAttendance}
              setError={setError}
              version={version}
            />
          )}
          {role === 'data_entry' && (
            <FinalizationFallback busy={busy} run={runAttendance} version={version} />
          )}
          {editors.has(role) && (
            <form className="panel" onSubmit={create}>
              <h2>Schedule a meeting</h2>
              <label className="field">
                Title
                <input
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="field">
                Description
                <textarea
                  required
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="field">
                Date in India
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="field">
                Start time in India
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label className="field">
                Location label
                <input
                  maxLength={240}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy}>
                Create meeting
              </button>
            </form>
          )}
          <section className="panel">
            <h2>Visible meetings</h2>
            {meetings.length === 0 ? (
              <p>No meetings to show.</p>
            ) : (
              meetings.map((meeting) => (
                <article key={meeting.meeting_id} className="panel">
                  <h3>{meeting.title}</h3>
                  <p>{meeting.description}</p>
                  <p className="muted">
                    {meeting.meeting_date} · {meeting.status}
                  </p>
                  <MeetingAttendance
                    meeting={meeting}
                    mine={attendance[meeting.meeting_id]}
                    busy={busy}
                    run={runAttendance}
                    setError={setError}
                    version={version}
                  />
                  {meeting.my_rsvp === 'invited' &&
                    meeting.status === 'active' &&
                    new Date(meeting.starts_at).getTime() > Date.now() && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            command(
                              'respond_committee_meeting',
                              {
                                p_meeting_id: meeting.meeting_id,
                                p_response: 'accept',
                                p_reason: null,
                              },
                              `accept:${meeting.meeting_id}`,
                            )
                          }
                        >
                          Accept invitation
                        </button>
                        <label className="field">
                          Decline reason (optional)
                          <input
                            value={declineReasons[meeting.meeting_id] ?? ''}
                            onChange={(e) =>
                              setDeclineReasons((current) => ({
                                ...current,
                                [meeting.meeting_id]: e.target.value,
                              }))
                            }
                            maxLength={500}
                          />
                        </label>
                        <button
                          disabled={busy}
                          onClick={() =>
                            command(
                              'respond_committee_meeting',
                              {
                                p_meeting_id: meeting.meeting_id,
                                p_response: 'decline',
                                p_reason: declineReasons[meeting.meeting_id]?.trim() || null,
                              },
                              `decline:${meeting.meeting_id}:${declineReasons[meeting.meeting_id]?.trim() ?? ''}`,
                            )
                          }
                        >
                          Decline
                        </button>
                      </>
                    )}
                  {editors.has(role) && meeting.my_rsvp === null && meeting.status === 'active' && (
                    <>
                      <MemberSelect
                        label="Member to invite"
                        excludeSelf
                        value={invitees[meeting.meeting_id] ?? ''}
                        onChange={(value) =>
                          setInvitees((current) => ({ ...current, [meeting.meeting_id]: value }))
                        }
                      />
                      <button
                        disabled={
                          busy ||
                          !invitees[meeting.meeting_id]?.trim() ||
                          new Date(meeting.starts_at).getTime() <= Date.now()
                        }
                        onClick={async () => {
                          const memberId = invitees[meeting.meeting_id]?.trim();
                          if (
                            await command(
                              'invite_committee_meeting',
                              {
                                p_meeting_id: meeting.meeting_id,
                                p_member_id: memberId,
                              },
                              `invite:${meeting.meeting_id}:${memberId}`,
                            )
                          )
                            setInvitees((current) => ({ ...current, [meeting.meeting_id]: '' }));
                        }}
                      >
                        Invite member
                      </button>
                      <label className="field">
                        Cancellation reason (3–500 characters)
                        <input
                          maxLength={500}
                          value={cancelReasons[meeting.meeting_id] ?? ''}
                          onChange={(e) =>
                            setCancelReasons((current) => ({
                              ...current,
                              [meeting.meeting_id]: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        disabled={
                          busy || (cancelReasons[meeting.meeting_id]?.trim().length ?? 0) < 3
                        }
                        onClick={() => {
                          if (
                            !window.confirm(
                              'Cancel this meeting? Invitees will see it as cancelled.',
                            )
                          )
                            return;
                          const cancelReason = cancelReasons[meeting.meeting_id].trim();
                          command(
                            'cancel_committee_meeting',
                            {
                              p_meeting_id: meeting.meeting_id,
                              p_reason: cancelReason,
                            },
                            `cancel:${meeting.meeting_id}:${cancelReason}`,
                          );
                        }}
                      >
                        Cancel meeting
                      </button>
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
