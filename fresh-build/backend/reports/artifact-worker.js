import { createHash } from 'node:crypto';
import { renderReportCsv } from './csv.js';
import { snapshotRows } from './handler.js';
import { renderReportPdf } from './pdf.js';

const BUCKET = 'finance-reports-private';
const MAX_BYTES = 15_000_000;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

export async function runReportArtifactTick({ client, enabled }) {
  if (!enabled) return null;
  if (!client?.rpc || !client?.storage || !client?.from)
    throw new Error('artifact_worker_unavailable');
  const claims = await rpc(client, 'claim_finance_report_artifact', {});
  if (!Array.isArray(claims) || claims.length > 1) throw new Error('invalid_artifact_claim');
  if (!claims.length) return null;
  const { run_id: runId, format, lease_token: lease } = claims[0];
  if (
    !/^[0-9a-f-]{36}$/i.test(runId ?? '') ||
    !['csv', 'pdf'].includes(format) ||
    !/^[0-9a-f-]{36}$/i.test(lease ?? '')
  )
    throw new Error('invalid_artifact_claim');
  const path = `${runId}/${format}/${lease}.${format}`;
  let stage = 'snapshot';
  let uploaded = false;
  try {
    const { data: metadata, error: metadataError } = await client
      .from('finance_report_runs')
      .select('period_kind,start_date,end_exclusive_date,include_proofs,cutoff_at')
      .eq('id', runId)
      .single();
    if (metadataError || !metadata) throw metadataError ?? new Error('report_not_found');
    const [lines, balances] = await Promise.all([
      snapshotRows(client, 'worker_finance_report_lines', runId, 10000),
      snapshotRows(client, 'worker_finance_report_balances', runId, 500),
    ]);
    stage = 'render';
    const rendered =
      format === 'pdf'
        ? await renderReportPdf({ runId, metadata, lines, balances })
        : renderReportCsv({ runId, lines, balances });
    const bytes = Buffer.from(rendered.bytes);
    if (!bytes.length || bytes.length > MAX_BYTES || digest(bytes) !== rendered.sha256)
      throw new Error('artifact_too_large_or_invalid');
    stage = 'upload';
    const bucket = client.storage.from(BUCKET);
    const { error: uploadError } = await bucket.upload(path, bytes, {
      contentType: format === 'pdf' ? 'application/pdf' : 'text/csv',
      upsert: false,
    });
    if (uploadError) throw uploadError;
    uploaded = true;
    stage = 'verify';
    const { data: stored, error: downloadError } = await bucket.download(path);
    if (downloadError || !stored) throw downloadError ?? new Error('artifact_readback_failed');
    if (!Number.isSafeInteger(stored.size) || stored.size !== bytes.length)
      throw new Error('artifact_readback_mismatch');
    const storedBytes = Buffer.from(await stored.arrayBuffer());
    if (storedBytes.length !== bytes.length || digest(storedBytes) !== rendered.sha256)
      throw new Error('artifact_readback_mismatch');
    stage = 'finish';
    const finished = await rpc(client, 'finish_finance_report_artifact', {
      p_run_id: runId,
      p_format: format,
      p_lease_token: lease,
      p_object_path: path,
      p_sha256: rendered.sha256,
      p_byte_count: bytes.length,
    });
    if (finished !== true) throw new Error('artifact_lease_lost');
    return { runId, format, status: 'ready' };
  } catch (error) {
    let cleaned = !uploaded;
    // A lost finish response may mean the database already points to this path.
    // Keep the object for the ready record or guarded operator recovery.
    if (stage !== 'finish' && (stage === 'upload' || uploaded)) {
      try {
        const { error: removeError } = await client.storage.from(BUCKET).remove([path]);
        cleaned = !removeError;
      } catch {
        cleaned = false;
      }
    }
    const terminal =
      !cleaned ||
      ['upload', 'verify', 'finish'].includes(stage) ||
      error?.message === 'artifact_too_large_or_invalid';
    const code =
      error?.message === 'artifact_too_large_or_invalid'
        ? 'artifact_too_large'
        : stage === 'snapshot'
          ? 'snapshot_unavailable'
          : stage === 'render'
            ? 'render_failed'
            : terminal
              ? 'upload_ambiguous'
              : 'storage_unavailable';
    const failed = await rpc(client, 'fail_finance_report_artifact', {
      p_run_id: runId,
      p_format: format,
      p_lease_token: lease,
      p_failure_code: code,
      p_terminal: terminal,
    });
    if (failed !== true) throw new Error('artifact_failure_state_unavailable');
    return { runId, format, status: 'failed', code };
  }
}
