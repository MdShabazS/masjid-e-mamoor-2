import { createHash } from 'node:crypto';

export async function readReportArtifact(service, runId, format) {
  const { data: artifact, error } = await service
    .from('finance_report_artifacts')
    .select('status,object_path,sha256,byte_count')
    .eq('run_id', runId)
    .eq('format', format)
    .maybeSingle();
  if (error) throw error;
  if (!artifact || ['queued', 'processing'].includes(artifact.status)) return { status: 'pending' };
  if (artifact.status === 'failed') return { status: 'failed' };
  if (
    artifact.status !== 'ready' ||
    !artifact.object_path ||
    !/^[0-9a-f]{64}$/.test(artifact.sha256 ?? '') ||
    !Number.isInteger(artifact.byte_count) ||
    artifact.byte_count < 1 ||
    artifact.byte_count > 15_000_000
  )
    throw new Error('invalid_artifact_record');
  const expectedPath = new RegExp(`^${runId}/${format}/[0-9a-f-]{36}\\.${format}$`, 'i');
  if (!expectedPath.test(artifact.object_path)) throw new Error('invalid_artifact_path');
  const { data: blob, error: downloadError } = await service.storage
    .from('finance-reports-private')
    .download(artifact.object_path);
  if (downloadError || !blob) throw downloadError ?? new Error('artifact_missing');
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (
    bytes.length !== artifact.byte_count ||
    createHash('sha256').update(bytes).digest('hex') !== artifact.sha256
  )
    throw new Error('artifact_digest_mismatch');
  return { status: 'ready', bytes, sha256: artifact.sha256 };
}
