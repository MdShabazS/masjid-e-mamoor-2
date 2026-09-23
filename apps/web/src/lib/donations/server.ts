import "server-only";

import type {
  AdditionalDonation,
  DonationObligation,
  DonationObligationRule,
  DonationOutstandingSnapshot,
  DonationObligationWaiver,
  DonationPayment,
  DonationPaymentAllocation,
} from "@masjid-e-mamoor/types";

import { createClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

const donationPaymentProofIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DonationPaymentProof {
  id: string;
  paymentId: string;
  storageBucket: string;
  storageObjectPath: string;
  uploadedByApplicationUserId: string;
  createdAt: string;
}

export class DonationPaymentProofAccessError extends Error {
  constructor() {
    super("Donation payment proof is not available.");
    this.name = "DonationPaymentProofAccessError";
  }
}

function asString(value: unknown): string {
  return String(value);
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function asNumber(value: unknown): number {
  return Number(value);
}

function mapObligation(row: DbRow): DonationObligation {
  return {
    id: asString(row.id),
    memberProfileId: asString(row.member_profile_id),
    obligationRuleId: asNullableString(row.obligation_rule_id),
    effectiveMonth: asString(row.effective_month),
    authoritativeAmountPaise: asNumber(row.authoritative_amount_paise),
    status: row.status as DonationObligation["status"],
    createdAt: asString(row.created_at),
  };
}

function mapOutstandingSnapshot(
  value: unknown,
): DonationOutstandingSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Outstanding snapshot returned an invalid result.",
    );
  }

  const snapshot = value as DbRow;

  const rawObligations = Array.isArray(
    snapshot.obligations,
  )
    ? snapshot.obligations
    : [];

  return {
    totalOutstandingPaise: asNumber(
      snapshot.total_outstanding_paise ?? 0,
    ),
    obligationCount: asNumber(
      snapshot.obligation_count ?? 0,
    ),
    obligations: rawObligations.map((value) => {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        throw new Error(
          "Outstanding snapshot contains an invalid obligation.",
        );
      }

      const row = value as DbRow;

      return {
        id: asString(row.id),
        memberProfileId: asString(
          row.member_profile_id,
        ),
        obligationRuleId: asNullableString(
          row.obligation_rule_id,
        ),
        effectiveMonth: asString(
          row.effective_month,
        ),
        authoritativeAmountPaise: asNumber(
          row.authoritative_amount_paise,
        ),
        allocatedAmountPaise: asNumber(
          row.allocated_amount_paise,
        ),
        waivedAmountPaise: asNumber(
          row.waived_amount_paise,
        ),
        outstandingAmountPaise: asNumber(
          row.outstanding_amount_paise,
        ),
        status:
          row.status as DonationOutstandingSnapshot[
            "obligations"
          ][number]["status"],
        createdAt: asString(row.created_at),
      };
    }),
  };
}

function mapPayment(row: DbRow): DonationPayment {
  return {
    id: asString(row.id),
    memberProfileId: asString(row.member_profile_id),
    amountPaise: asNumber(row.amount_paise),
    paymentMethod: row.payment_method as DonationPayment["paymentMethod"],
    status: row.status as DonationPayment["status"],
    submittedByApplicationUserId: asString(
      row.submitted_by_application_user_id,
    ),
    reviewedByApplicationUserId: asNullableString(
      row.reviewed_by_application_user_id,
    ),
    reviewedAt: asNullableString(row.reviewed_at),
    rejectionReason: asNullableString(row.rejection_reason),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapAllocation(row: DbRow): DonationPaymentAllocation {
  return {
    id: asString(row.id),
    paymentId: asString(row.payment_id),
    obligationId: asString(row.obligation_id),
    allocatedAmountPaise: asNumber(row.allocated_amount_paise),
    allocationSequence: asNumber(row.allocation_sequence),
    createdAt: asString(row.created_at),
  };
}

function mapWaiver(row: DbRow): DonationObligationWaiver {
  return {
    id: asString(row.id),
    obligationId: asString(row.obligation_id),
    waivedAmountPaise: asNumber(row.waived_amount_paise),
    reason: asString(row.reason),
    actorApplicationUserId: asString(
      row.actor_application_user_id,
    ),
    createdAt: asString(row.created_at),
  };
}

function mapAdditionalDonation(row: DbRow): AdditionalDonation {
  return {
    id: asString(row.id),
    memberProfileId: asNullableString(row.member_profile_id),
    sourcePaymentId: asNullableString(row.source_payment_id),
    donationKind: row.donation_kind as AdditionalDonation["donationKind"],
    amountPaise: asNumber(row.amount_paise),
    recordedByApplicationUserId: asString(
      row.recorded_by_application_user_id,
    ),
    createdAt: asString(row.created_at),
  };
}

function mapRule(row: DbRow): DonationObligationRule {
  return {
    id: asString(row.id),
    effectiveFromMonth: asString(row.effective_from_month),
    monthlyAmountPaise: asNumber(row.monthly_amount_paise),
    createdAt: asString(row.created_at),
  };
}

function mapPaymentProof(row: DbRow): DonationPaymentProof {
  return {
    id: asString(row.id),
    paymentId: asString(row.payment_id),
    storageBucket: asString(row.storage_bucket),
    storageObjectPath: asString(row.storage_object_path),
    uploadedByApplicationUserId: asString(
      row.uploaded_by_application_user_id,
    ),
    createdAt: asString(row.created_at),
  };
}

function unwrapRpcRow<T>(
  data: unknown,
  mapper: (row: DbRow) => T,
): T {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error("Trusted donation operation returned no result.");
  }

  return mapper(row as DbRow);
}

export async function getDonationOutstandingSnapshot(): Promise<DonationOutstandingSnapshot> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_donation_outstanding_snapshot",
  );

  if (error) {
    throw error;
  }

  return mapOutstandingSnapshot(data);
}

export async function getDonationObligations(): Promise<
  DonationObligation[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_obligations")
    .select("*")
    .order("effective_month", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapObligation(row));
}

export async function getDonationPayments(): Promise<
  DonationPayment[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_payments")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapPayment(row));
}

export async function getDonationAllocations(): Promise<
  DonationPaymentAllocation[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_payment_allocations")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapAllocation(row));
}

export async function getDonationWaivers(): Promise<
  DonationObligationWaiver[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_obligation_waivers")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapWaiver(row));
}

export async function getAdditionalDonations(): Promise<
  AdditionalDonation[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("additional_donations")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapAdditionalDonation(row));
}

export async function getDonationObligationRules(): Promise<
  DonationObligationRule[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_obligation_rules")
    .select("*")
    .order("effective_from_month", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRule(row));
}

export async function getDonationPaymentProofs(): Promise<
  DonationPaymentProof[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_payment_proofs")
    .select("*")
    .order("payment_id", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapPaymentProof(row));
}

export async function createDonationPaymentProofSignedUrl(
  proofId: string,
): Promise<string> {
  if (!donationPaymentProofIdPattern.test(proofId)) {
    throw new DonationPaymentProofAccessError();
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("donation_payment_proofs")
    .select("*")
    .eq("id", proofId)
    .maybeSingle();

  if (error || !data) {
    throw new DonationPaymentProofAccessError();
  }

  const proof = mapPaymentProof(data);

  const { data: signedData, error: signedError } =
    await supabase.storage
      .from(proof.storageBucket)
      .createSignedUrl(proof.storageObjectPath, 60);

  if (signedError || !signedData?.signedUrl) {
    throw new DonationPaymentProofAccessError();
  }

  return signedData.signedUrl;
}

export async function submitDonationPayment(input: {
  amountPaise: number;
  paymentMethod: string;
  operationId: string;
}): Promise<DonationPayment> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "submit_donation_payment",
    {
      p_amount_paise: input.amountPaise,
      p_payment_method: input.paymentMethod,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapPayment);
}

export async function startDonationPaymentReview(input: {
  paymentId: string;
  operationId: string;
}): Promise<DonationPayment> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "start_donation_payment_review",
    {
      p_payment_id: input.paymentId,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapPayment);
}

export async function rejectDonationPayment(input: {
  paymentId: string;
  reason: string;
  operationId: string;
}): Promise<DonationPayment> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "reject_donation_payment",
    {
      p_payment_id: input.paymentId,
      p_reason: input.reason,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapPayment);
}

export async function verifyAndAllocateDonationPayment(input: {
  paymentId: string;
  operationId: string;
}): Promise<DonationPayment> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "verify_and_allocate_donation_payment",
    {
      p_payment_id: input.paymentId,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapPayment);
}

export async function waiveDonationObligation(input: {
  obligationId: string;
  waivedAmountPaise: number;
  reason: string;
  operationId: string;
}): Promise<DonationObligationWaiver> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "waive_donation_obligation",
    {
      p_obligation_id: input.obligationId,
      p_waived_amount_paise: input.waivedAmountPaise,
      p_reason: input.reason,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapWaiver);
}

export async function createAdditionalDonation(input: {
  amountPaise: number;
  operationId: string;
}): Promise<AdditionalDonation> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "create_additional_donation",
    {
      p_amount_paise: input.amountPaise,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapAdditionalDonation);
}

export async function createAnonymousDonation(input: {
  amountPaise: number;
  operationId: string;
}): Promise<AdditionalDonation> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "create_anonymous_donation",
    {
      p_amount_paise: input.amountPaise,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapAdditionalDonation);
}

export async function createJummahCashDonation(input: {
  amountPaise: number;
  operationId: string;
}): Promise<AdditionalDonation> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "create_jummah_cash_donation",
    {
      p_amount_paise: input.amountPaise,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapAdditionalDonation);
}

export async function createDonationObligationRule(input: {
  effectiveFromMonth: string;
  monthlyAmountPaise: number;
  operationId: string;
}): Promise<DonationObligationRule> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "create_donation_obligation_rule",
    {
      p_effective_from_month: input.effectiveFromMonth,
      p_monthly_amount_paise: input.monthlyAmountPaise,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  return unwrapRpcRow(data, mapRule);
}

export async function generateMonthlyDonationObligations(input: {
  effectiveMonth: string;
  operationId: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "generate_monthly_donation_obligations",
    {
      p_effective_month: input.effectiveMonth,
      p_operation_id: input.operationId,
    },
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error("Obligation generation returned no result.");
  }

  const result = row as DbRow;

  return {
    effectiveMonth: asString(result.effective_month),
    obligationRuleId: asString(result.obligation_rule_id),
    authoritativeAmountPaise: asNumber(
      result.authoritative_amount_paise,
    ),
    createdCount: asNumber(result.created_count),
  };
}

export async function getDonationManagementCapabilities() {
  const supabase = await createClient();

  const [
    { data: canVerify, error: verifyError },
    { data: canAllocate, error: allocateError },
    { data: canManageObligations, error: manageError },
    {
      data: canCreateAnonymousDonation,
      error: anonymousError,
    },
    {
      data: canCreateJummahCashDonation,
      error: jummahError,
    },
  ] = await Promise.all([
    supabase.rpc("has_application_permission", {
      requested_permission: "donations.payments.verify",
    }),
    supabase.rpc("has_application_permission", {
      requested_permission: "donations.payments.allocate",
    }),
    supabase.rpc("has_application_permission", {
      requested_permission: "donations.obligations.manage",
    }),
    supabase.rpc("has_application_permission", {
      requested_permission: "donations.anonymous.create",
    }),
    supabase.rpc("has_application_permission", {
      requested_permission: "donations.jummah.create",
    }),
  ]);

  if (
    verifyError ||
    allocateError ||
    manageError ||
    anonymousError ||
    jummahError
  ) {
    throw new Error("Unable to resolve donation management permissions.");
  }

  return {
    canVerify: canVerify === true,
    canAllocate: canAllocate === true,
    canVerifyAndAllocate:
      canVerify === true && canAllocate === true,
    canManageObligations: canManageObligations === true,
    canCreateAnonymousDonation:
      canCreateAnonymousDonation === true,
    canCreateJummahCashDonation:
      canCreateJummahCashDonation === true,
  };
}
