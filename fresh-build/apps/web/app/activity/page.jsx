'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { monthReport, yearReport } from '../../../../packages/api-client/report-period.js';
import { userMessage } from '../../../../packages/api-client/messages.js';
import { MemberSelect, indiaToday, rpc, useManagementPage } from '../../lib/management.js';

/** One member's Activity points. There is deliberately no ranking or list of everyone. */
export default function ActivityPage() {
  const [memberId, setMemberId] = useState('');
  const [kind, setKind] = useState('month');
  const [month, setMonth] = useState(indiaToday().slice(0, 7));
  const [year, setYear] = useState(Number(indiaToday().slice(0, 4)));
  const [result, setResult] = useState(null);
  const page = useManagementPage(null);
  const target = memberId || (page.role === 'system_admin' ? '' : page.userId);
  const { session, setError } = page;

  useEffect(() => {
    setResult(null);
    if (session !== 'ready' || !target) return;
    let active = true;
    try {
      const period = kind === 'month' ? monthReport(`${month}-01`) : yearReport(year);
      rpc('member_activity', {
        p_member_id: target,
        p_start: period.p_start,
        p_end_exclusive: period.p_end_exclusive,
      })
        .then((rows) => active && setResult(rows?.[0] ?? null))
        .catch(
          (cause) => active && setError(userMessage(cause, 'Could not load activity points.')),
        );
    } catch (cause) {
      setError(userMessage(cause));
    }
    return () => {
      active = false;
    };
  }, [session, target, kind, month, year, setError]);

  return (
    <main className="management">
      <Link href="/contributors">← Management</Link>
      <h1>Activity points</h1>
      <p className="muted">
        A count of verified work, attended meetings and referred monthly support. It is not a
        measure of anyone’s faith or worth.
      </p>
      {page.session === 'checking' && <p>Checking your account…</p>}
      {page.session === 'signed-out' && (
        <p>
          <Link href="/login">Sign in</Link> to continue.
        </p>
      )}
      {page.error && (
        <p role="alert" className="notice error">
          {page.error}
        </p>
      )}
      {page.session === 'ready' && (
        <section className="panel">
          <MemberSelect
            label="Member"
            value={memberId}
            onChange={setMemberId}
            emptyLabel={page.role === 'system_admin' ? 'Choose a member' : 'You'}
          />
          <label className="field">
            Period
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </label>
          {kind === 'month' ? (
            <label className="field">
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </label>
          ) : (
            <label className="field">
              Year
              <input
                type="number"
                min="2020"
                max="2100"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
          )}
          {!target && <p className="muted">Choose a member to see their points.</p>}
          {result && (
            <div className="report-scroll">
              <h2>
                {result.username} · {result.role.replaceAll('_', ' ')}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>How it is counted</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Tasks</td>
                    <td>
                      {result.task_points} completed and accepted · {result.tasks_joined} joined
                    </td>
                    <td>{result.task_points}</td>
                  </tr>
                  <tr>
                    <td>Meetings</td>
                    <td>
                      {result.meeting_points} attended of {result.meetings_finalized} finalized ·{' '}
                      {result.meetings_declined} declined · {result.meetings_absent} absent
                    </td>
                    <td>{result.meeting_points}</td>
                  </tr>
                  <tr>
                    <td>Referrals</td>
                    <td>
                      {result.referral_points} paid months of {result.referral_months_requested}{' '}
                      requested from referred donors
                    </td>
                    <td>{result.referral_points}</td>
                  </tr>
                  <tr>
                    <th>Total</th>
                    <td>Tasks + meetings + referrals</td>
                    <th>{result.activity_points}</th>
                  </tr>
                </tbody>
              </table>
              <p className="muted">
                Only finalized meetings count. A voided payment or cancelled task removes its point.
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
