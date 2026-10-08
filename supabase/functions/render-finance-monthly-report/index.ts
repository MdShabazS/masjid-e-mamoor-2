import { createClient } from "npm:@supabase/supabase-js@2.116.0";

import {
  isValidPdfBytes,
  MAX_PDF_BYTES,
  renderFinanceMonthlyReportPdf,
  sha256Hex,
  validateReportMonth,
} from "./pdf.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

type JsonRecord = Record<string, unknown>;

interface ReportRow extends JsonRecord {
  id: string;
  report_month: string;
  revision: number;
  generation_source: string;
  snapshot_sha256: string;
  storage_bucket: string;
  storage_object_path: string;
  file_sha256: string | null;
  file_size_bytes: number | null;
}

interface ClaimRow extends JsonRecord {
  claim_status: "claimed" | "busy" | "ready";
  report_id: string;
  render_token: string | null;
  storage_bucket: string;
  storage_object_path: string;
  snapshot_sha256: string;
  snapshot: unknown;
}

class SafeHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
  ) {
    super(code);
  }
}

function jsonResponse(
  body: JsonRecord,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function firstRpcRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  if (value !== null && typeof value === "object") return value as T;
  return null;
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new SafeHttpError(
      500,
      "renderer:configuration_error",
      "The report renderer is not configured.",
    );
  }
  return value;
}

function parseAuthorization(request: Request): {
  header: string;
  token: string;
} {
  const header = request.headers.get("Authorization")?.trim() ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) {
    throw new SafeHttpError(
      401,
      "renderer:auth_failed",
      "Authentication is required.",
    );
  }
  return { header, token: match[1] };
}

type RenderRequest =
  | { mode: "manual"; reportMonth: string }
  | { mode: "scheduled" };

async function parseRenderRequest(request: Request): Promise<RenderRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new SafeHttpError(
      400,
      "renderer:invalid_request",
      "A valid JSON request is required.",
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new SafeHttpError(
      400,
      "renderer:invalid_request",
      "The request body must be a JSON object.",
    );
  }

  const record = body as JsonRecord;
  const keys = Object.keys(record);

  if (
    keys.length === 1 &&
    keys[0] === "mode" &&
    record.mode === "scheduled"
  ) {
    return { mode: "scheduled" };
  }

  if (
    keys.length === 1 &&
    keys[0] === "report_month" &&
    validateReportMonth(record.report_month)
  ) {
    return { mode: "manual", reportMonth: record.report_month };
  }

  throw new SafeHttpError(
    400,
    "renderer:invalid_request",
    "Provide report_month as YYYY-MM-01 or mode=scheduled.",
  );
}

async function schedulerSecretMatches(request: Request): Promise<boolean> {
  const supplied =
    request.headers.get("x-finance-scheduler-secret")?.trim() ?? "";
  const expected = requiredEnvironment("FINANCE_MONTHLY_SCHEDULER_SECRET");

  if (!supplied || !expected) return false;

  const encoder = new TextEncoder();
  const [suppliedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);

  const suppliedBytes = new Uint8Array(suppliedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;

  for (let index = 0; index < suppliedBytes.length; index += 1) {
    difference |= suppliedBytes[index] ^ expectedBytes[index];
  }

  return difference === 0;
}

function isAuthorizationError(error: JsonRecord | null): boolean {
  return error?.code === "42501" || error?.message === "not_authorized";
}

function isStorageCollision(error: JsonRecord | null): boolean {
  const status = String(error?.statusCode ?? error?.status ?? "");
  const code = String(error?.error ?? error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  return status === "409" ||
    code.includes("duplicate") ||
    code.includes("already_exists") ||
    message.includes("already exists") ||
    message.includes("duplicate");
}

function createServerClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

type ServerClient = ReturnType<typeof createServerClient>;

async function failClaimBestEffort(
  serverClient: ServerClient,
  reportId: string,
  renderToken: string,
  errorCode: string,
): Promise<void> {
  try {
    await serverClient.rpc("fail_finance_monthly_report_render", {
      p_report_id: reportId,
      p_render_token: renderToken,
      p_error_code: errorCode,
    });
  } catch {
    // The lease may have expired or another worker may already have finalized.
  }
}

function readyResponse(report: ReportRow): Response {
  return jsonResponse({
    status: "ready",
    report_id: report.id,
    report_month: report.report_month,
    revision: report.revision,
    storage_bucket: report.storage_bucket,
    storage_object_path: report.storage_object_path,
    file_sha256: report.file_sha256,
    file_size_bytes: report.file_size_bytes,
  });
}

async function recoverExistingPdf(
  serverClient: ServerClient,
  bucket: string,
  path: string,
): Promise<Uint8Array | null> {
  const { data, error } = await serverClient.storage.from(bucket).download(
    path,
  );
  if (error || !data) return null;

  const bytes = new Uint8Array(await data.arrayBuffer());
  return isValidPdfBytes(bytes) ? bytes : null;
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        code: "renderer:method_not_allowed",
        message: "Only POST requests are supported.",
      },
      405,
    );
  }

  const renderRequest = await parseRenderRequest(request);
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");

  let report: ReportRow;
  let serverClient: ServerClient;

  if (renderRequest.mode === "scheduled") {
    if (!(await schedulerSecretMatches(request))) {
      throw new SafeHttpError(
        403,
        "renderer:scheduler_not_authorized",
        "The scheduled report request is not authorized.",
      );
    }

    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    serverClient = createServerClient(supabaseUrl, serviceRoleKey);

    const { data: generatedData, error: generatedError } =
      await serverClient.rpc(
        "generate_scheduled_finance_monthly_report_snapshot",
      );

    if (generatedError) {
      throw new SafeHttpError(
        500,
        "renderer:snapshot_failed",
        "The scheduled Finance snapshot could not be prepared.",
      );
    }

    const scheduledReport = firstRpcRow<ReportRow>(generatedData);
    if (!scheduledReport?.id) {
      throw new SafeHttpError(
        500,
        "renderer:snapshot_failed",
        "The scheduled Finance snapshot could not be prepared.",
      );
    }

    report = scheduledReport;
  } else {
    const { header: authorization, token } = parseAuthorization(request);
    const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(
      token,
    );
    if (userError || !userData.user) {
      throw new SafeHttpError(
        401,
        "renderer:auth_failed",
        "The authenticated session is invalid.",
      );
    }

    const { data: generatedData, error: generatedError } =
      await userClient.rpc(
        "generate_finance_monthly_report_snapshot",
        { p_report_month: renderRequest.reportMonth },
      );

    if (generatedError) {
      if (isAuthorizationError(generatedError as unknown as JsonRecord)) {
        throw new SafeHttpError(
          403,
          "renderer:not_authorized",
          "You are not authorized to generate monthly Finance reports.",
        );
      }
      throw new SafeHttpError(
        500,
        "renderer:snapshot_failed",
        "The authoritative Finance snapshot could not be prepared.",
      );
    }

    const manualReport = firstRpcRow<ReportRow>(generatedData);
    if (!manualReport?.id) {
      throw new SafeHttpError(
        500,
        "renderer:snapshot_failed",
        "The authoritative Finance snapshot could not be prepared.",
      );
    }

    report = manualReport;

    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    serverClient = createServerClient(supabaseUrl, serviceRoleKey);
  }

  const { data: claimData, error: claimError } = await serverClient.rpc(
    "claim_finance_monthly_report_render",
    { p_report_id: report.id },
  );
  if (claimError) {
    throw new SafeHttpError(
      500,
      "renderer:claim_failed",
      "The report rendering claim could not be acquired.",
    );
  }

  const claim = firstRpcRow<ClaimRow>(claimData);
  if (!claim) {
    throw new SafeHttpError(
      500,
      "renderer:claim_failed",
      "The report rendering claim could not be acquired.",
    );
  }

  if (claim.claim_status === "ready") return readyResponse(report);

  if (claim.claim_status === "busy") {
    return jsonResponse(
      { status: "busy", report_id: report.id },
      202,
    );
  }

  if (
    claim.claim_status !== "claimed" ||
    !claim.render_token ||
    !claim.storage_bucket ||
    !claim.storage_object_path ||
    !claim.snapshot_sha256 ||
    claim.snapshot === null ||
    claim.snapshot === undefined
  ) {
    throw new SafeHttpError(
      500,
      "renderer:claim_failed",
      "The report rendering claim was incomplete.",
    );
  }

  const renderToken = claim.render_token;
  let pdfBytes: Uint8Array;

  try {
    pdfBytes = await renderFinanceMonthlyReportPdf(claim.snapshot, {
      reportMonth: report.report_month,
      revision: report.revision,
      snapshotSha256: claim.snapshot_sha256,
      generationSource: report.generation_source,
      storageObjectPath: claim.storage_object_path,
    });
    if (!isValidPdfBytes(pdfBytes)) throw new Error("invalid_pdf");
  } catch {
    await failClaimBestEffort(
      serverClient,
      report.id,
      renderToken,
      "renderer:pdf_failed",
    );
    throw new SafeHttpError(
      500,
      "renderer:pdf_failed",
      "The monthly Finance PDF could not be rendered.",
    );
  }

  const storage = serverClient.storage.from(claim.storage_bucket);
  const { error: uploadError } = await storage.upload(
    claim.storage_object_path,
    pdfBytes,
    { contentType: "application/pdf", upsert: false },
  );

  if (uploadError) {
    const existingBytes = await recoverExistingPdf(
      serverClient,
      claim.storage_bucket,
      claim.storage_object_path,
    );

    if (existingBytes) {
      pdfBytes = existingBytes;
    } else {
      const errorCode = isStorageCollision(
          uploadError as unknown as JsonRecord,
        )
        ? "renderer:storage_collision"
        : "renderer:upload_failed";
      await failClaimBestEffort(
        serverClient,
        report.id,
        renderToken,
        errorCode,
      );
      throw new SafeHttpError(
        500,
        errorCode,
        "The monthly Finance PDF could not be stored safely.",
      );
    }
  }

  if (pdfBytes.length > MAX_PDF_BYTES || !isValidPdfBytes(pdfBytes)) {
    await failClaimBestEffort(
      serverClient,
      report.id,
      renderToken,
      "renderer:storage_collision",
    );
    throw new SafeHttpError(
      500,
      "renderer:storage_collision",
      "The stored monthly Finance PDF is invalid.",
    );
  }

  const fileSha256 = await sha256Hex(pdfBytes);
  const { data: completedData, error: completedError } = await serverClient.rpc(
    "complete_finance_monthly_report_render",
    {
      p_report_id: report.id,
      p_render_token: renderToken,
      p_file_sha256: fileSha256,
      p_file_size_bytes: pdfBytes.length,
    },
  );

  if (completedError) {
    await failClaimBestEffort(
      serverClient,
      report.id,
      renderToken,
      "renderer:complete_failed",
    );
    throw new SafeHttpError(
      500,
      "renderer:complete_failed",
      "The monthly Finance report could not be finalized.",
    );
  }

  const completed = firstRpcRow<ReportRow>(completedData);
  if (!completed) {
    throw new SafeHttpError(
      500,
      "renderer:complete_failed",
      "The monthly Finance report could not be finalized.",
    );
  }

  return readyResponse(completed);
}

Deno.serve(async (request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    if (error instanceof SafeHttpError) {
      if (error.status >= 500) {
        console.error(`[render-finance-monthly-report] ${error.code}`);
      }
      return jsonResponse(
        { code: error.code, message: error.publicMessage },
        error.status,
      );
    }

    console.error("[render-finance-monthly-report] renderer:unexpected_error");
    return jsonResponse(
      {
        code: "renderer:unexpected_error",
        message: "The monthly Finance report could not be rendered.",
      },
      500,
    );
  }
});
