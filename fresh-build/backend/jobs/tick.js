import { timingSafeEqual } from 'node:crypto';

function equalToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || b.length < 32) return false;
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function assertJobAuthorization(authorization, secret) {
  if (!equalToken(authorization, `Bearer ${secret}`)) throw new Error('job_unauthorized');
}

export async function runQueueTick({ authorization, secret, client, now = new Date() }) {
  assertJobAuthorization(authorization, secret);
  if (!client?.rpc || !Number.isFinite(now.getTime())) throw new Error('job_unavailable');
  const actions = [
    ['dispatch_first_friday_monthly_requests', { p_now: now.toISOString() }],
    ['queue_due_monthly_reminders', { p_now: now.toISOString() }],
    ['queue_due_committee_meeting_reminders', { p_now: now.toISOString() }],
    ['queue_due_member_post_notifications', {}],
  ];
  const results = {};
  for (const [name, args] of actions) {
    const { data, error } = await client.rpc(name, args);
    if (error || !Number.isInteger(data)) throw new Error('job_storage_unavailable');
    results[name] = data;
  }
  return results;
}
