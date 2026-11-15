const BUCKET = 'finance-reports-private';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function validate(runId, format) {
  if (!UUID.test(runId ?? '') || !['csv', 'pdf'].includes(format))
    throw new Error('invalid_artifact_identity');
}

async function loadFailed(client, runId, format) {
  const { data, error } = await client
    .from('finance_report_artifacts')
    .select(
      'status,attempts,failure_code,last_attempt_path,lease_token,lease_expires_at,updated_at',
    )
    .eq('run_id', runId)
    .eq('format', format)
    .single();
  if (error || !data) throw new Error('artifact_state_unavailable');
  const path = data.last_attempt_path;
  const parts = path?.split('/') ?? [];
  const lease = parts[2]?.endsWith(`.${format}`) ? parts[2].slice(0, -format.length - 1) : '';
  if (
    data.status !== 'failed' ||
    data.attempts !== 3 ||
    data.lease_token !== null ||
    data.lease_expires_at !== null ||
    parts.length !== 3 ||
    !UUID.test(lease) ||
    path !== `${runId}/${format}/${lease}.${format}` ||
    !data.failure_code
  )
    throw new Error('artifact_not_terminal_or_path_unknown');
  const readyAfter = ['upload_ambiguous', 'lease_expired'].includes(data.failure_code)
    ? new Date(new Date(data.updated_at).getTime() + 10 * 60_000).toISOString()
    : null;
  return { path, failureCode: data.failure_code, readyAfter };
}

async function objectExists(bucket, runId, format, path) {
  const prefix = `${runId}/${format}`;
  const { data, error } = await bucket.list(prefix, { limit: 100, offset: 0 });
  if (error || !Array.isArray(data) || data.length >= 100)
    throw new Error('artifact_storage_inspection_failed');
  return data.some((item) => `${prefix}/${item.name}` === path);
}

export async function inspectReportArtifactRecovery({ client, runId, format }) {
  validate(runId, format);
  if (!client?.from || !client?.storage) throw new Error('recovery_client_unavailable');
  const state = await loadFailed(client, runId, format);
  const bucket = client.storage.from(BUCKET);
  const objectPresent = await objectExists(bucket, runId, format, state.path);
  return { runId, format, ...state, objectPresent };
}

export async function recoverReportArtifact({ client, runId, format, operatorNote }) {
  if (!operatorNote || operatorNote.trim().length < 3 || operatorNote.length > 200)
    throw new Error('invalid_recovery_operator_note');
  const inspected = await inspectReportArtifactRecovery({ client, runId, format });
  if (inspected.readyAfter && Date.now() < Date.parse(inspected.readyAfter))
    throw new Error('artifact_recovery_cooldown');
  const bucket = client.storage.from(BUCKET);
  if (inspected.objectPresent) {
    const { error } = await bucket.remove([inspected.path]);
    if (error) throw new Error('artifact_orphan_removal_failed');
  }
  if (await objectExists(bucket, runId, format, inspected.path))
    throw new Error('artifact_orphan_still_present');
  const { data, error } = await client.rpc('requeue_failed_finance_report_artifact', {
    p_run_id: runId,
    p_format: format,
    p_expected_path: inspected.path,
    p_expected_failure_code: inspected.failureCode,
    p_operator_note: operatorNote.trim(),
  });
  if (error || data !== true) throw new Error('artifact_requeue_rejected');
  return { runId, format, status: 'queued', removedOrphan: inspected.objectPresent };
}
