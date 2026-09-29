import { randomUUID } from "expo-crypto";
import {
  referralCodeSchema,
  referralOnboardingSubmitSchema,
} from "@masjid-e-mamoor/validation";
import { supabase } from "../lib/supabase";

export interface PublicReferralValidation {
  valid: boolean;
  status: string;
  referrerDisplayName: string | null;
}

export async function validatePublicReferralCode(
  referralCode: string,
): Promise<PublicReferralValidation> {
  const parsed = referralCodeSchema.safeParse(referralCode);
  if (!parsed.success) return { valid: false, status: "invalid", referrerDisplayName: null };

  const { data, error } = await supabase.rpc("validate_referral_code", {
    p_referral_code: parsed.data,
  });
  if (error) return { valid: false, status: "invalid", referrerDisplayName: null };

  const row = (data?.[0] ?? null) as Record<string, unknown> | null;
  return {
    valid: row?.valid === true,
    status: row?.status == null ? "invalid" : String(row.status),
    referrerDisplayName:
      row?.referrer_display_name == null ? null : String(row.referrer_display_name),
  };
}

export async function submitPublicReferralOnboarding(
  referralCode: string,
  displayName: string,
  phone: string,
) {
  const parsed = referralOnboardingSubmitSchema.safeParse({
    referralCode,
    displayName,
    phone,
    operationId: randomUUID(),
  });
  if (!parsed.success) throw new Error("invalid_referral_submission");

  const { error } = await supabase.rpc("submit_referral_onboarding", {
    p_referral_code: parsed.data.referralCode,
    p_display_name: parsed.data.displayName,
    p_phone: parsed.data.phone,
    p_operation_id: parsed.data.operationId,
  });
  if (error) throw new Error("referral_submission_failed");
}
