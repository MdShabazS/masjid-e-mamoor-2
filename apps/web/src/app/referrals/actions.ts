"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import {
  referralDecisionSchema,
  referralProvisionSchema,
  referralRejectSchema,
} from "@masjid-e-mamoor/validation";
import {
  approveReferral,
  completeReferralProvisioning,
  createReferral,
  rejectReferral,
} from "@/lib/referrals/server";

export type ReferralActionState = {
  error?: string;
  message?: string;
  temporaryPassword?: string | null;
};

const genericError = "The referral action could not be completed.";

export async function createReferralAction() {
  await createReferral();
  revalidatePath("/referrals");
}

export async function approveReferralAction(formData: FormData) {
  const parsed = referralDecisionSchema.safeParse({
    referralId: formData.get("referralId"),
    operationId: formData.get("operationId") || randomUUID(),
  });

  if (!parsed.success) return;

  await approveReferral(parsed.data.referralId, parsed.data.operationId);
  revalidatePath("/referrals");
}

export async function rejectReferralAction(formData: FormData) {
  const parsed = referralRejectSchema.safeParse({
    referralId: formData.get("referralId"),
    reason: formData.get("reason") || null,
    operationId: formData.get("operationId") || randomUUID(),
  });

  if (!parsed.success) return;

  await rejectReferral({
    referralId: parsed.data.referralId,
    reason: parsed.data.reason ?? null,
    operationId: parsed.data.operationId,
  });
  revalidatePath("/referrals");
}

export async function completeReferralProvisionAction(
  _state: ReferralActionState,
  formData: FormData,
): Promise<ReferralActionState> {
  const parsed = referralProvisionSchema.safeParse({
    referralId: formData.get("referralId"),
    username: formData.get("username"),
    password: formData.get("password") || undefined,
    operationId: formData.get("operationId") || randomUUID(),
  });

  if (!parsed.success) {
    return { error: "Check the referral, username, and password." };
  }

  try {
    const result = await completeReferralProvisioning(parsed.data);
    return {
      message: "Member account provisioned.",
      temporaryPassword: result.temporaryPassword,
    };
  } catch {
    return { error: genericError };
  }
}
