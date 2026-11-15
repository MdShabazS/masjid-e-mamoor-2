import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHealth } from './health.js';
const now = new Date('2026-10-16T00:00:00Z');
function snapshot() {
  return {
    observedAt: '2026-10-15T23:59:00Z',
    database: { reachable: true },
    backup: { completedAt: '2026-10-15T02:00:00Z', databaseVerified: true, objectsVerified: true },
    finance: { variancePaise: '0' },
    jobs: { failed: 0, stale: 0 },
    reports: { failed: 0 },
    whatsapp: { enabled: false, failed: 0, staleSending: 0 },
  };
}
test('fresh verified snapshot stays healthy with provider disabled', () => {
  assert.deepEqual(evaluateHealth(snapshot(), { now }).alerts, []);
});
test('stale backup, finance variance, queue and report failures name owners', () => {
  const x = snapshot();
  x.backup.completedAt = '2026-10-14T00:00:00Z';
  x.finance.variancePaise = '-1';
  x.jobs.stale = 1;
  x.reports.failed = 2;
  assert.deepEqual(
    evaluateHealth(x, { now }).alerts.map((a) => a.code),
    ['BACKUP_UNVERIFIED', 'FINANCE_VARIANCE', 'JOBS_UNHEALTHY', 'REPORTS_FAILED'],
  );
});
test('enabled delivery failures alert, redacted snapshots reject extra fields', () => {
  const x = snapshot();
  x.whatsapp.enabled = true;
  x.whatsapp.failed = 1;
  assert.equal(evaluateHealth(x, { now }).alerts.at(-1).code, 'WHATSAPP_DELIVERY_UNHEALTHY');
  x.donorPhone = 'private';
  assert.throws(() => evaluateHealth(x, { now }), /invalid_health_snapshot/);
});
test('invalid and future timestamps or negative counters fail closed', () => {
  const x = snapshot();
  x.observedAt = '2026-11-01T00:00:00Z';
  assert.throws(() => evaluateHealth(x, { now }));
  x.observedAt = '2026-10-15T23:59:00Z';
  x.jobs.failed = -1;
  assert.throws(() => evaluateHealth(x, { now }));
});
test('stale operational snapshot is never reported healthy', () => {
  const x = snapshot();
  x.observedAt = '2026-10-15T23:40:00Z';
  assert.equal(evaluateHealth(x, { now }).alerts[0].code, 'SNAPSHOT_STALE');
});
