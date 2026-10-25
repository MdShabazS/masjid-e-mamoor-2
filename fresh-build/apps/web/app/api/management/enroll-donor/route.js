import { createClient } from '@supabase/supabase-js';
import { parseINRToPaise } from '../../../../../../packages/api-client/index.js';

export const runtime = 'nodejs';
const allowed = new Set([
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'committee_member',
  'member',
  'data_entry',
]);
const output = (status, code) =>
  Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const url = process.env.SUPABASE_URL,
    publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const consentVersion = process.env.APPROVED_DONOR_CONSENT_VERSION;
  if (!url || !publicKey || !secretKey || !consentVersion)
    return output(503, 'ENROLLMENT_DISABLED');
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return output(401, 'AUTH_REQUIRED');
  if (Number(request.headers.get('content-length')) > 4096) return output(413, 'INVALID_INPUT');
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return output(413, 'INVALID_INPUT');
    body = JSON.parse(raw);
    if (
      !body ||
      Array.isArray(body) ||
      typeof body !== 'object' ||
      Object.keys(body).some(
        (k) =>
          ![
            'name',
            'whatsapp',
            'suggestedAmountINR',
            'referrerId',
            'consentMethod',
            'consentRecordedAt',
            'evidenceReference',
          ].includes(k),
      )
    )
      return output(400, 'INVALID_INPUT');
    if (
      !body.evidenceReference ||
      typeof body.evidenceReference !== 'string' ||
      body.evidenceReference.trim().length < 3 ||
      body.evidenceReference.length > 240
    )
      return output(400, 'INVALID_INPUT');
  } catch {
    return output(400, 'INVALID_INPUT');
  }
  const token = authorization.slice(7);
  const actor = createClient(url, publicKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  try {
    const { data: userData, error: userError } = await actor.auth.getUser(token);
    if (userError || !userData?.user?.id) return output(401, 'AUTH_REQUIRED');
    const { data: gateRows, error: gateError } = await actor.rpc('current_identity_gate');
    const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
    if (gateError || !gate?.account_active || gate.must_change_password)
      return output(403, 'FORBIDDEN');
    const { data: role, error: roleError } = await actor.rpc('current_app_role');
    if (roleError || !allowed.has(role)) return output(403, 'FORBIDDEN');
    const amount = parseINRToPaise(body.suggestedAmountINR);
    const server = createClient(url, secretKey, { auth: { persistSession: false } });
    const { data, error } = await server.rpc('enroll_versioned_monthly_donor', {
      p_name: body.name,
      p_whatsapp: body.whatsapp,
      p_suggested_amount_paise: amount,
      p_referrer_id: body.referrerId ?? null,
      p_entered_by: userData.user.id,
      p_consent_method: body.consentMethod,
      p_consent_recorded_at: body.consentRecordedAt,
      p_consent_version: consentVersion,
      p_evidence_reference: body.evidenceReference,
    });
    if (error)
      return output(
        error.code === '23505' ? 409 : 400,
        error.code === '23505' ? 'DUPLICATE_REVIEW' : 'ENROLLMENT_REJECTED',
      );
    return Response.json({ data: { donorId: data } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return output(503, 'SERVICE_UNAVAILABLE');
  }
}
