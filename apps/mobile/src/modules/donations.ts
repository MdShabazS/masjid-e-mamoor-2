import { CryptoDigestAlgorithm, digest, randomUUID } from "expo-crypto";
import type {
  AdditionalDonation,
  DonationObligationRule,
  DonationOutstandingSnapshot,
  DonationPayment,
  DonationPaymentAllocation,
  DonationPaymentMethod,
} from "@masjid-e-mamoor/types";
import {
  additionalDonationCreateSchema,
  anonymousDonationCreateSchema,
  donationObligationGenerationSchema,
  donationObligationRuleCreateSchema,
  donationObligationWaiverSchema,
  donationPaymentRejectSchema,
  donationPaymentReviewSchema,
  donationPaymentSubmitSchema,
  donationPaymentVerifySchema,
  jummahCashDonationCreateSchema,
} from "@masjid-e-mamoor/validation";
import { supabase } from "../lib/supabase";
import {
  bytesToHex,
  deterministicDonationProofPath,
  DONATION_PROOF_BUCKET,
  mapDonationOutstandingSnapshot,
  parseRupeesToPaise,
  validateDonationProofBytes,
  validateDonationProofMetadata,
} from "./donation-presentation";

type DbRow = Record<string, unknown>;

export interface DonationPaymentProof {
  id: string;
  paymentId: string;
  storageBucket: string;
  storageObjectPath: string;
  createdAt: string;
}

export interface DonationGenerationResult {
  effectiveMonth: string;
  obligationRuleId: string;
  authoritativeAmountPaise: number;
  createdCount: number;
}

function asNullableString(value: unknown) {
  return value == null ? null : String(value);
}

function mapPayment(row: DbRow): DonationPayment {
  return {
    id: String(row.id),
    memberProfileId: String(row.member_profile_id),
    amountPaise: Number(row.amount_paise),
    paymentMethod: row.payment_method as DonationPayment["paymentMethod"],
    status: row.status as DonationPayment["status"],
    submittedByApplicationUserId: String(row.submitted_by_application_user_id),
    reviewedByApplicationUserId: asNullableString(row.reviewed_by_application_user_id),
    reviewedAt: asNullableString(row.reviewed_at),
    rejectionReason: asNullableString(row.rejection_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAllocation(row: DbRow): DonationPaymentAllocation {
  return {
    id: String(row.id),
    paymentId: String(row.payment_id),
    obligationId: String(row.obligation_id),
    allocatedAmountPaise: Number(row.allocated_amount_paise),
    allocationSequence: Number(row.allocation_sequence),
    createdAt: String(row.created_at),
  };
}

function mapProof(row: DbRow): DonationPaymentProof {
  return {
    id: String(row.id),
    paymentId: String(row.payment_id),
    storageBucket: String(row.storage_bucket),
    storageObjectPath: String(row.storage_object_path),
    createdAt: String(row.created_at),
  };
}

function mapAdditionalDonation(row: DbRow): AdditionalDonation {
  return {
    id: String(row.id),
    memberProfileId: asNullableString(row.member_profile_id),
    sourcePaymentId: asNullableString(row.source_payment_id),
    donationKind: row.donation_kind as AdditionalDonation["donationKind"],
    amountPaise: Number(row.amount_paise),
    recordedByApplicationUserId: String(row.recorded_by_application_user_id),
    createdAt: String(row.created_at),
  };
}

function mapRule(row: DbRow): DonationObligationRule {
  return {
    id: String(row.id),
    effectiveFromMonth: String(row.effective_from_month),
    monthlyAmountPaise: Number(row.monthly_amount_paise),
    createdAt: String(row.created_at),
  };
}

function unwrapRow(data: unknown): DbRow {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("donation_operation_failed");
  }
  return row as DbRow;
}

export async function getDonationOutstandingSnapshot(): Promise<DonationOutstandingSnapshot> {
  const { data, error } = await supabase.rpc("get_donation_outstanding_snapshot");
  if (error) throw new Error("donations_unavailable");
  return mapDonationOutstandingSnapshot(data);
}

export async function listDonationPayments() {
  const { data, error } = await supabase
    .from("donation_payments")
    .select("id, member_profile_id, amount_paise, payment_method, status, submitted_by_application_user_id, reviewed_by_application_user_id, reviewed_at, rejection_reason, created_at, updated_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error("donations_unavailable");
  return (data ?? []).map((row) => mapPayment(row as DbRow));
}

export async function getDonationPayment(paymentId: string) {
  const { data, error } = await supabase
    .from("donation_payments")
    .select("id, member_profile_id, amount_paise, payment_method, status, submitted_by_application_user_id, reviewed_by_application_user_id, reviewed_at, rejection_reason, created_at, updated_at")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error("donations_unavailable");
  return data ? mapPayment(data as DbRow) : null;
}

export async function listDonationAllocations(paymentId?: string) {
  let query = supabase
    .from("donation_payment_allocations")
    .select("id, payment_id, obligation_id, allocated_amount_paise, allocation_sequence, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (paymentId) query = query.eq("payment_id", paymentId);
  const { data, error } = await query;
  if (error) throw new Error("donations_unavailable");
  return (data ?? []).map((row) => mapAllocation(row as DbRow));
}

export async function listDonationProofs(paymentId?: string) {
  let query = supabase
    .from("donation_payment_proofs")
    .select("id, payment_id, storage_bucket, storage_object_path, created_at")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (paymentId) query = query.eq("payment_id", paymentId);
  const { data, error } = await query;
  if (error) throw new Error("donations_unavailable");
  return (data ?? []).map((row) => mapProof(row as DbRow));
}

export async function listAdditionalDonations() {
  const { data, error } = await supabase
    .from("additional_donations")
    .select("id, member_profile_id, source_payment_id, donation_kind, amount_paise, recorded_by_application_user_id, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error("donations_unavailable");
  return (data ?? []).map((row) => mapAdditionalDonation(row as DbRow));
}

export async function listDonationObligationRules() {
  const { data, error } = await supabase
    .from("donation_obligation_rules")
    .select("id, effective_from_month, monthly_amount_paise, created_at")
    .order("effective_from_month", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error("donations_unavailable");
  return (data ?? []).map((row) => mapRule(row as DbRow));
}

function amountPaise(raw: string) {
  return parseRupeesToPaise(raw) ?? Number.NaN;
}

export async function submitDonationPayment(amount: string, paymentMethod: DonationPaymentMethod) {
  const input = donationPaymentSubmitSchema.parse({
    amountPaise: amountPaise(amount),
    paymentMethod,
    operationId: randomUUID(),
  });
  const { error } = await supabase.rpc("submit_donation_payment", {
    p_amount_paise: input.amountPaise,
    p_payment_method: input.paymentMethod,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("payment_submit_failed");
}

export async function createAdditionalDonation(amount: string) {
  const input = additionalDonationCreateSchema.parse({
    amountPaise: amountPaise(amount),
    operationId: randomUUID(),
  });
  const { error } = await supabase.rpc("create_additional_donation", {
    p_amount_paise: input.amountPaise,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("additional_donation_failed");
}

export async function startDonationPaymentReview(paymentId: string) {
  const input = donationPaymentReviewSchema.parse({ paymentId, operationId: randomUUID() });
  const { error } = await supabase.rpc("start_donation_payment_review", {
    p_payment_id: input.paymentId,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("review_failed");
}

export async function rejectDonationPayment(paymentId: string, reason: string) {
  const input = donationPaymentRejectSchema.parse({ paymentId, reason, operationId: randomUUID() });
  const { error } = await supabase.rpc("reject_donation_payment", {
    p_payment_id: input.paymentId,
    p_reason: input.reason,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("rejection_failed");
}

export async function verifyAndAllocateDonationPayment(input: {
  paymentId: string;
  financeAccountId: string;
  businessDate: string;
}) {
  const parsed = donationPaymentVerifySchema.parse({
    ...input,
    operationId: randomUUID(),
  });

  const { error } = await supabase.rpc(
    "verify_and_allocate_donation_payment",
    {
      p_payment_id: parsed.paymentId,
      p_finance_account_id: parsed.financeAccountId,
      p_business_date: parsed.businessDate,
      p_operation_id: parsed.operationId,
    },
  );

  if (error) throw new Error("verification_failed");
}

export async function waiveDonationObligation(
  obligationId: string,
  waivedAmount: string,
  reason: string,
) {
  const input = donationObligationWaiverSchema.parse({
    obligationId,
    waivedAmountPaise: amountPaise(waivedAmount),
    reason,
    operationId: randomUUID(),
  });
  const { error } = await supabase.rpc("waive_donation_obligation", {
    p_obligation_id: input.obligationId,
    p_waived_amount_paise: input.waivedAmountPaise,
    p_reason: input.reason,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("waiver_failed");
}

export async function createDonationObligationRule(effectiveMonth: string, amount: string) {
  const input = donationObligationRuleCreateSchema.parse({
    effectiveFromMonth: effectiveMonth,
    monthlyAmountPaise: amountPaise(amount),
    operationId: randomUUID(),
  });
  const { error } = await supabase.rpc("create_donation_obligation_rule", {
    p_effective_from_month: input.effectiveFromMonth,
    p_monthly_amount_paise: input.monthlyAmountPaise,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("rule_failed");
}

export async function generateMonthlyDonationObligations(
  effectiveMonth: string,
): Promise<DonationGenerationResult> {
  const input = donationObligationGenerationSchema.parse({ effectiveMonth, operationId: randomUUID() });
  const { data, error } = await supabase.rpc("generate_monthly_donation_obligations", {
    p_effective_month: input.effectiveMonth,
    p_operation_id: input.operationId,
  });
  if (error) throw new Error("generation_failed");
  const row = unwrapRow(data);
  return {
    effectiveMonth: String(row.effective_month),
    obligationRuleId: String(row.obligation_rule_id),
    authoritativeAmountPaise: Number(row.authoritative_amount_paise),
    createdCount: Number(row.created_count),
  };
}

async function createUnattributedDonation(kind: "anonymous" | "jummah_cash", amount: string) {
  const schema = kind === "anonymous" ? anonymousDonationCreateSchema : jummahCashDonationCreateSchema;
  const input = schema.parse({ amountPaise: amountPaise(amount), operationId: randomUUID() });
  const { error } = await supabase.rpc(
    kind === "anonymous" ? "create_anonymous_donation" : "create_jummah_cash_donation",
    { p_amount_paise: input.amountPaise, p_operation_id: input.operationId },
  );
  if (error) throw new Error(`${kind}_donation_failed`);
}

export function createAnonymousDonation(amount: string) {
  return createUnattributedDonation("anonymous", amount);
}

export function createJummahCashDonation(amount: string) {
  return createUnattributedDonation("jummah_cash", amount);
}

async function proofIsRegistered(paymentId: string, objectPath: string) {
  const { data, error } = await supabase
    .from("donation_payment_proofs")
    .select("id")
    .eq("payment_id", paymentId)
    .eq("storage_object_path", objectPath)
    .maybeSingle();
  return !error && Boolean(data);
}

async function registerDonationProof(paymentId: string, objectPath: string) {
  const { error } = await supabase.rpc("register_donation_payment_proof", {
    p_payment_id: paymentId,
    p_storage_object_path: objectPath,
  });
  return !error || proofIsRegistered(paymentId, objectPath);
}

export async function uploadDonationPaymentProof(
  paymentId: string,
  asset: { uri: string; mimeType?: string | null; size?: number | null },
) {
  const metadataError = validateDonationProofMetadata(asset.mimeType, asset.size);
  if (metadataError || !asset.mimeType) throw new Error("invalid_proof");

  const response = await fetch(asset.uri);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (validateDonationProofBytes(asset.mimeType, bytes)) throw new Error("invalid_proof");

  const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes));
  const objectPath = deterministicDonationProofPath(
    paymentId,
    bytesToHex(hash),
    asset.mimeType,
  );

  const { error: uploadError } = await supabase.storage
    .from(DONATION_PROOF_BUCKET)
    .upload(objectPath, bytes, {
      contentType: asset.mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError && (await proofIsRegistered(paymentId, objectPath))) return;
  if (await registerDonationProof(paymentId, objectPath)) return;
  throw new Error("proof_upload_failed");
}

export async function createDonationProofSignedUrl(proofId: string) {
  const { data, error } = await supabase
    .from("donation_payment_proofs")
    .select("storage_bucket, storage_object_path")
    .eq("id", proofId)
    .maybeSingle();
  if (error || !data) throw new Error("proof_unavailable");

  const { data: signed, error: signedError } = await supabase.storage
    .from(String(data.storage_bucket))
    .createSignedUrl(String(data.storage_object_path), 60);
  if (signedError || !signed?.signedUrl) throw new Error("proof_unavailable");
  return signed.signedUrl;
}
