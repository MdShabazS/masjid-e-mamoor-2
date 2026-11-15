import { allowed, failure, snapshotRows } from './handler.js';
import { renderReportPdf } from './pdf.js';
import { readReportArtifact } from './artifact-read.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createReportPdfHandler({
  createClient,
  url,
  publishableKey,
  serviceKey,
  limiter,
  enabled,
  artifactMode = false,
  onInternalError = /** @type {(stage: string, error: unknown) => void} */ (() => {}),
}) {
  return async function handleReportPdf(request) {
    if (!enabled || !url || !publishableKey || !serviceKey || !limiter)
      return failure(503, 'SERVICE_UNAVAILABLE');
    const runId = new URL(request.url).searchParams.get('runId');
    if (!runId || !UUID.test(runId)) return failure(400, 'INVALID_REPORT');
    const authorization = request.headers.get('authorization') ?? '';
    if (!/^Bearer [^\s]+$/.test(authorization)) return failure(401, 'AUTH_REQUIRED');
    const actor = createClient(url, publishableKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    let stage = 'identity';
    try {
      const { data: userData, error: userError } = await actor.auth.getUser(authorization.slice(7));
      if (userError || !userData?.user?.id) return failure(401, 'AUTH_REQUIRED');
      if (!(await allowed(actor))) return failure(403, 'FORBIDDEN');
      if (!(await limiter.consume(`reportpdf:${userData.user.id}`)))
        return failure(429, 'RATE_LIMITED');
      stage = 'metadata';
      const service = createClient(url, serviceKey, { auth: { persistSession: false } });
      if (artifactMode) {
        stage = 'artifact';
        const artifact = await readReportArtifact(service, runId, 'pdf');
        if (artifact.status === 'pending') return failure(202, 'REPORT_PENDING');
        if (artifact.status === 'failed') return failure(503, 'REPORT_FAILED');
        stage = 'identity_recheck';
        if (!(await allowed(actor))) return failure(403, 'FORBIDDEN');
        return new Response(artifact.bytes, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="finance-report-${runId}.pdf"`,
            'Content-Length': String(artifact.bytes.length),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Report-SHA256': artifact.sha256,
          },
        });
      }
      const { data: metadata, error: metadataError } = await service
        .from('finance_report_runs')
        .select('period_kind,start_date,end_exclusive_date,include_proofs,cutoff_at')
        .eq('id', runId)
        .single();
      if (metadataError) throw metadataError;
      if (!metadata) return failure(404, 'REPORT_NOT_FOUND');
      stage = 'snapshot';
      const [lines, balances] = await Promise.all([
        snapshotRows(actor, 'list_finance_report_lines', runId, 10000),
        snapshotRows(actor, 'list_finance_report_balances', runId, 500),
      ]);
      stage = 'render';
      const { bytes, sha256 } = await renderReportPdf({ runId, metadata, lines, balances });
      stage = 'identity_recheck';
      if (!(await allowed(actor))) return failure(403, 'FORBIDDEN');
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="finance-report-${runId}.pdf"`,
          'Content-Length': String(bytes.length),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Report-SHA256': sha256,
        },
      });
    } catch (error) {
      onInternalError?.(stage, error);
      return failure(503, 'SERVICE_UNAVAILABLE');
    }
  };
}
