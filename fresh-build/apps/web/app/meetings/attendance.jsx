'use client';
import { useCallback, useEffect, useState } from 'react';
import { locationArgs, parseSiteCoordinates } from '../../../../packages/api-client/attendance.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { indiaToday, rpc } from '../../lib/management.js';

/** A fresh browser reading, never a cached one; the server stores only distance and accuracy. */
function currentFix() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser cannot share location. Use the Android app to check in.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          resolve(locationArgs(position));
        } catch (cause) {
          reject(cause);
        }
      },
      (failure) =>
        reject(
          new Error(
            failure.code === 1
              ? 'Allow location access in the browser to check in.'
              : 'Could not read your location. Try again outdoors.',
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

const outcomeLabels = { attended: 'Attended', declined: 'Declined', absent: 'Absent' };

function Roster({ meetingId, canMark, busy, run, version }) {
  const [rows, setRows] = useState(null);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    rpc('list_committee_meeting_roster', { p_meeting_id: meetingId })
      .then((data) => setRows(data ?? []))
      .catch((cause) => setError(userMessage(cause, 'Could not load the roster.')));
  }, [meetingId]);
  useEffect(load, [load, version]);

  async function mark() {
    setError('');
    let fix;
    try {
      fix = await currentFix();
    } catch (cause) {
      setError(cause.message);
      return;
    }
    if (
      await run(
        'mark_committee_attendance',
        { p_meeting_id: meetingId, p_member_id: selected, ...fix, p_reason: reason.trim() },
        'Marked present from your location at the masjid.',
      )
    ) {
      setSelected('');
      setReason('');
    }
  }

  if (error)
    return (
      <p role="alert" className="notice error">
        {error}
      </p>
    );
  if (!rows) return <p className="muted">Loading roster…</p>;
  return (
    <div>
      <h4>Attendance roster</h4>
      <ul className="roster">
        {rows.map((row) => (
          <li key={row.member_id}>
            <span>{row.username}</span>
            <small>
              {row.outcome
                ? outcomeLabels[row.outcome]
                : row.attendance_source === 'gps'
                  ? 'Checked in by location'
                  : row.attendance_source === 'organizer'
                    ? 'Marked by organizer'
                    : row.invite_status === 'declined'
                      ? 'Declined'
                      : 'Not checked in'}
            </small>
          </li>
        ))}
      </ul>
      {canMark && (
        <>
          <label className="field">
            Mark present (you must be at the masjid)
            <select value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Choose</option>
              {rows
                .filter((row) => !row.attendance_source && row.invite_status !== 'declined')
                .map((row) => (
                  <option key={row.member_id} value={row.member_id}>
                    {row.username}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Why can’t their phone check in? (3–500 characters)
            <input maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button disabled={busy || !selected || reason.trim().length < 3} onClick={mark}>
            Mark present
          </button>
        </>
      )}
    </div>
  );
}

/** Check-in and organizer controls for one meeting. */
export function MeetingAttendance({ meeting, mine, busy, run, setError, version }) {
  const [rosterOpen, setRosterOpen] = useState(false);
  if (meeting.status !== 'active' || !mine) return null;
  const today = indiaToday();
  const isToday = meeting.meeting_date === today;
  const dayOver = meeting.meeting_date < today;
  const canCheckIn =
    isToday && !mine.attendance_source && ['invited', 'accepted'].includes(meeting.my_rsvp);

  async function checkIn() {
    setError('');
    try {
      const fix = await currentFix();
      await run(
        'check_in_committee_meeting',
        { p_meeting_id: meeting.meeting_id, ...fix },
        'You are checked in.',
      );
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <div>
      {mine.outcome && <p>Final attendance: {outcomeLabels[mine.outcome]}</p>}
      {!mine.outcome && mine.attendance_source && (
        <p className="notice">You are marked present for this meeting.</p>
      )}
      {canCheckIn && (
        <button className="primary" disabled={busy} onClick={checkIn}>
          Check in at the masjid
        </button>
      )}
      {mine.is_creator && (
        <>
          <p>
            <button onClick={() => setRosterOpen(!rosterOpen)}>
              {rosterOpen ? 'Hide roster' : 'View attendance roster'}
            </button>
          </p>
          {rosterOpen && (
            <Roster
              meetingId={meeting.meeting_id}
              canMark={isToday}
              busy={busy}
              run={run}
              version={version}
            />
          )}
          {dayOver && !mine.finalized && (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Finalize? Everyone invited who did not attend or decline becomes absent. This cannot be changed.',
                  )
                )
                  run(
                    'finalize_committee_meeting',
                    { p_meeting_id: meeting.meeting_id, p_reason: null },
                    'Attendance finalized.',
                  );
              }}
            >
              Finalize attendance
            </button>
          )}
          {mine.finalized && <p className="muted">Attendance is finalized.</p>}
        </>
      )}
    </div>
  );
}

/** Data entry employee: finalize meetings an organizer left open. Never creates presence. */
export function FinalizationFallback({ busy, run, version }) {
  const [meetings, setMeetings] = useState([]);
  const [reasons, setReasons] = useState({});
  useEffect(() => {
    rpc('list_meetings_pending_finalization')
      .then((rows) => setMeetings(rows ?? []))
      .catch(() => setMeetings([]));
  }, [version]);
  return (
    <section className="panel">
      <h2>Meetings waiting to be finalized</h2>
      <p className="muted">
        Use this only when the organizer has not finalized. You cannot mark anyone present.
      </p>
      {meetings.length === 0 && <p>No meetings are waiting.</p>}
      {meetings.map((item) => (
        <article key={item.meeting_id} className="panel">
          <h3>
            {item.title} · {item.meeting_date}
          </h3>
          <p className="muted">Organizer: {item.organizer}</p>
          <Roster
            meetingId={item.meeting_id}
            canMark={false}
            busy={busy}
            run={run}
            version={version}
          />
          <label className="field">
            Why the organizer could not finalize
            <input
              maxLength={500}
              value={reasons[item.meeting_id] ?? ''}
              onChange={(e) => setReasons({ ...reasons, [item.meeting_id]: e.target.value })}
            />
          </label>
          <button
            disabled={busy || (reasons[item.meeting_id]?.trim().length ?? 0) < 3}
            onClick={() => {
              if (window.confirm('Finalize? Invited members who did not attend become absent.'))
                run(
                  'finalize_committee_meeting',
                  { p_meeting_id: item.meeting_id, p_reason: reasons[item.meeting_id].trim() },
                  'Attendance finalized with your recorded reason.',
                );
            }}
          >
            Finalize attendance
          </button>
        </article>
      ))}
    </section>
  );
}

/** System Admin: the single verified point check-in measures from. */
export function MasjidSiteSetting({ busy, run, setError, version }) {
  const [site, setSite] = useState(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [evidence, setEvidence] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    rpc('get_masjid_site')
      .then((rows) => setSite(rows?.[0] ?? null))
      .catch(() => setSite(null));
  }, [version]);
  async function save(event) {
    event.preventDefault();
    try {
      const args = { ...parseSiteCoordinates(latitude, longitude), p_evidence: evidence.trim() };
      if (await run('set_masjid_site', args, 'Masjid location saved.')) {
        setLatitude('');
        setLongitude('');
        setEvidence('');
        setConfirmed(false);
      }
    } catch (cause) {
      setError(cause.message);
    }
  }
  return (
    <form className="panel" onSubmit={save}>
      <h2>Masjid location for check-in</h2>
      <p className="muted">
        {site
          ? `Current: ${site.latitude}, ${site.longitude} · ${site.radius_m} m · ${site.evidence_reference}`
          : 'Not set. Nobody can check in by location until this is set.'}
      </p>
      <label className="field">
        Latitude
        <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
      </label>
      <label className="field">
        Longitude
        <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
      </label>
      <label className="field">
        How this point was verified
        <input maxLength={240} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I checked this exact point at the masjid.
      </label>
      <button className="primary" disabled={busy || !confirmed || evidence.trim().length < 3}>
        Save masjid location
      </button>
    </form>
  );
}
