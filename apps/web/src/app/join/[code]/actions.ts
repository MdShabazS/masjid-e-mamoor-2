"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { referralOnboardingSubmitSchema } from "@masjid-e-mamoor/validation";
import { submitReferralOnboarding } from "@/lib/referrals/server";

export async function submitOnboardingRequestAction(formData: FormData) {
  const parsed = referralOnboardingSubmitSchema.safeParse({
    referralCode: formData.get("referralCode"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    operationId: formData.get("operationId") || randomUUID(),
  });

  if (!parsed.success) {
    redirect(`/join/${formData.get("referralCode") ?? ""}?error=invalid`);
  }

  try {
    await submitReferralOnboarding(parsed.data);
  } catch {
    redirect(`/join/${parsed.data.referralCode}?error=unavailable`);
  }

  redirect(`/join/${parsed.data.referralCode}?submitted=1`);
}
