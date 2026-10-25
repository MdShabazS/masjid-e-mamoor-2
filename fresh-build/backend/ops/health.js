// Input is a redacted, server-collected operational snapshot. No donor,
// credential, payment-reference, receipt-code or phone fields are accepted.
const FIELDS = ['observedAt', 'database', 'backup', 'finance', 'jobs', 'reports', 'whatsapp'];
const SECTIONS = {
  database: ['reachable'],
  backup: ['completedAt', 'databaseVerified', 'objectsVerified'],
  finance: ['variancePaise'],
  jobs: ['failed', 'stale'],
  reports: ['failed'],
  whatsapp: ['enabled', 'failed', 'staleSending'],
};
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

export function evaluateHealth(snapshot, { now = new Date(), maxBackupAgeHours = 26 } = {}) {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    Object.keys(snapshot).some((key) => !FIELDS.includes(key)) ||
    FIELDS.some((key) => !(key in snapshot)) ||
    !Number.isFinite(now.getTime()) ||
    !isCount(maxBackupAgeHours) ||
    maxBackupAgeHours === 0
  )
    throw new Error('invalid_health_snapshot');
  for (const [section, fields] of Object.entries(SECTIONS)) {
    const value = snapshot[section];
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some((key) => !fields.includes(key)) ||
      fields.some((key) => !(key in value))
    )
      throw new Error('invalid_health_snapshot');
  }
  const observed = Date.parse(snapshot.observedAt);
  const completed = Date.parse(snapshot.backup.completedAt);
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(completed) ||
    observed > now.getTime() + 60_000 ||
    completed > now.getTime() + 60_000 ||
    !/^(0|-[1-9][0-9]*|[1-9][0-9]*)$/.test(snapshot.finance.variancePaise) ||
    typeof snapshot.database.reachable !== 'boolean' ||
    typeof snapshot.backup.databaseVerified !== 'boolean' ||
    typeof snapshot.backup.objectsVerified !== 'boolean' ||
    typeof snapshot.whatsapp.enabled !== 'boolean' ||
    ![
      snapshot.jobs.failed,
      snapshot.jobs.stale,
      snapshot.reports.failed,
      snapshot.whatsapp.failed,
      snapshot.whatsapp.staleSending,
    ].every(isCount)
  )
    throw new Error('invalid_health_snapshot');
  const alerts = [];
  const alarm = (code, owner) => alerts.push({ code, owner });
  if (now.getTime() - observed > 15 * 60_000) alarm('SNAPSHOT_STALE', 'operations');
  if (!snapshot.database.reachable) alarm('DATABASE_UNAVAILABLE', 'backend');
  if (
    now.getTime() - completed > maxBackupAgeHours * 60 * 60_000 ||
    !snapshot.backup.databaseVerified ||
    !snapshot.backup.objectsVerified
  )
    alarm('BACKUP_UNVERIFIED', 'operations');
  if (snapshot.finance.variancePaise !== '0') alarm('FINANCE_VARIANCE', 'treasurer');
  if (snapshot.jobs.failed || snapshot.jobs.stale) alarm('JOBS_UNHEALTHY', 'backend');
  if (snapshot.reports.failed) alarm('REPORTS_FAILED', 'finance');
  if (snapshot.whatsapp.failed || snapshot.whatsapp.staleSending)
    alarm('WHATSAPP_DELIVERY_UNHEALTHY', 'messaging');
  return {
    status: alerts.length ? 'attention' : 'healthy',
    observedAt: snapshot.observedAt,
    alerts,
  };
}
