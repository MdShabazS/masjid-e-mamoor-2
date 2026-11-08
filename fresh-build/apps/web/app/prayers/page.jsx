'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { Messages, indiaToday, rpc, useCommand, useManagementPage } from '../../lib/management.js';

const MARKERS = new Set(['president', 'vice_president', 'secretary', 'treasurer']);
const slots = [
  ['fajr', 'Fajr'],
  ['dhuhr', 'Dhuhr'],
  ['asr', 'Asr'],
  ['maghrib', 'Maghrib'],
  ['isha', 'Isha'],
];

function nextDay(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

export default function PrayersPage() {
  const [date, setDate] = useState(indiaToday());
  const [marks, setMarks] = useState({});
  const [attested, setAttested] = useState(false);
  const page = useManagementPage(async (role) => {
    if (!MARKERS.has(role)) return;
    const rows = await rpc('list_hafiz_prayer_marks', {
      p_start: date,
      p_end_exclusive: nextDay(date),
    });
    setMarks(Object.fromEntries((rows ?? []).map((row) => [row.prayer_slot, row.mark])));
  });
  const { busy, notice, run } = useCommand(page.reload, page.setError);
  const { session, reload, setError } = page;
  // Sign-in already loaded the first date; reload only when the date changes later.
  const shownDate = useRef(date);
  useEffect(() => {
    if (session !== 'ready' || shownDate.current === date) return;
    shownDate.current = date;
    setMarks({});
    reload().catch((cause) => setError(userMessage(cause)));
  }, [date, session, reload, setError]);

  return (
    <main className="management">
      <Link href="/contributors">← Management</Link>
      <h1>Hafiz prayer register</h1>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      <Messages error={page.error} notice={notice} />
      {page.session === 'ready' && !MARKERS.has(page.role) && (
        <p>Only the President, Vice President, Secretary and Treasurer mark prayers.</p>
      )}
      {page.session === 'ready' && MARKERS.has(page.role) && (
        <section className="panel">
          <label className="field">
            Prayer date
            <input
              type="date"
              max={indiaToday()}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
            />
            This prayer has taken place and I can attest to it.
          </label>
          <ul className="roster">
            {slots.map(([slot, label]) => (
              <li key={slot}>
                <span>
                  {label}
                  <br />
                  <small>{marks[slot] ? `Marked ${marks[slot]}` : 'Not marked'}</small>
                </span>
                <span className="button-row">
                  {['present', 'absent'].map((mark) => (
                    <button
                      key={mark}
                      aria-label={`${label} ${mark}`}
                      aria-pressed={marks[slot] === mark}
                      disabled={busy || !attested || marks[slot] === mark}
                      onClick={() =>
                        run(
                          'record_hafiz_prayer',
                          {
                            p_date: date,
                            p_slot: slot,
                            p_mark: mark,
                            p_attested_after_prayer: true,
                          },
                          'Prayer mark saved. Earlier values stay in the change history.',
                        )
                      }
                    >
                      {mark === 'present' ? 'Present' : 'Absent'}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
