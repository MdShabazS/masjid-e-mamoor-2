import { renderReportCsv } from './csv.js';
import { readReportArtifact } from './artifact-read.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READERS = new Set(['system_admin', 'president', 'vice_president', 'secretary', 'treasurer']);
const PAGE_SIZE = 500;

export function failure(status, code) {
  return Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function snapshotRows(actor, rpcName, runId, max) {
  const rows = [];
  for (let offset = 0; offset <= max; offset += PAGE_SIZE) {
    const { data, error } = await actor
      .rpc(rpcName, { p_run_id: runId })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data) || data.length > PAGE_SIZE) throw new Error('invalid_report_page');
    rows.push(...data);
    if (rows.length > max) throw new Error('report_too_large');
    if (data.length < PAGE_SIZE) return rows;
  }
  throw new Error('report_too_large');
}

export async function allowed(actor) {
  const { data: gateRows, error: gateError } = await actor.rpc('current_identity_gate');
  const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
  if (gateError || !gate?.account_active || gate.must_change_password) return false;
  const { data: role, error: roleError } = await actor.rpc('current_app_role');
  return !roleError && READERS.has(role);
}

export function createReportCsvHandler({
  createClient,
  url,
  publishableKey,
  serviceKey,
  limiter,
  enabled,
  artifactMode = false,
  onInternalError = /** @type {(stage: string, error: unknown) => void} */ (() => {}),
}) {
  return async function handleReportCsv(request) {
    if (!enabled || !url || !publishableKey || !limiter || (artifactMode && !serviceKey))
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
      if (!(await limiter.consume(`reportcsv:${userData.user.id}`)))
        return failure(429, 'RATE_LIMITED');
      if (artifactMode) {
        stage = 'artifact';
        const service = createClient(url, serviceKey, { auth: { persistSession: false } });
        const artifact = await readReportArtifact(service, runId, 'csv');
        if (artifact.status === 'pending') return failure(202, 'REPORT_PENDING');
        if (artifact.status === 'failed') return failure(503, 'REPORT_FAILED');
        stage = 'identity_recheck';
        if (!(await allowed(actor))) return failure(403, 'FORBIDDEN');
        return new Response(artifact.bytes, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="finance-report-${runId}.csv"`,
            'Content-Length': String(artifact.bytes.length),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Report-SHA256': artifact.sha256,
          },
        });
      }
      stage = 'snapshot';
      const [lines, balances] = await Promise.all([
        snapshotRows(actor, 'list_finance_report_lines', runId, 10000),
        snapshotRows(actor, 'list_finance_report_balances', runId, 500),
      ]);
      stage = 'reconcile';
      const { bytes, sha256 } = renderReportCsv({ runId, lines, balances });
      stage = 'identity_recheck';
      if (!(await allowed(actor))) return failure(403, 'FORBIDDEN');
      return new Response(bytes, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="finance-report-${runId}.csv"`,
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
