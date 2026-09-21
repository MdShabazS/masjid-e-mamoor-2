"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  additionalDonationCreateSchema,
  donationObligationGenerationSchema,
  donationObligationRuleCreateSchema,
  donationObligationWaiverSchema,
  donationPaymentRejectSchema,
  donationPaymentReviewSchema,
  donationPaymentSubmitSchema,
  donationPaymentVerifySchema,
} from "@masjid-e-mamoor/validation";

import {
  createAdditionalDonation,
  createDonationObligationRule,
  generateMonthlyDonationObligations,
  rejectDonationPayment,
  startDonationPaymentReview,
  submitDonationPayment,
  verifyAndAllocateDonationPayment,
  waiveDonationObligation,
} from "@/lib/donations/server";

function rupeesToPaise(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return Number.NaN;
  }

  const [rupees, paise = ""] = raw.split(".");

  return (
    Number(rupees) * 100 +
    Number(paise.padEnd(2, "0"))
  );
}

function refreshDonationPaths() {
  revalidatePath("/donations");
  revalidatePath("/donations/manage");
  revalidatePath("/dashboard");
}

export async function submitPayment(formData: FormData) {
  const parsed = donationPaymentSubmitSchema.safeParse({
    amountPaise: rupeesToPaise(formData.get("amount")),
    paymentMethod: String(
      formData.get("paymentMethod") ?? "",
    ),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect("/donations?error=invalid_payment");
  }

  try {
    await submitDonationPayment(parsed.data);
  } catch {
    redirect("/donations?error=payment_submit_failed");
  }

  refreshDonationPaths();
  redirect("/donations?submitted=1");
}

export async function submitAdditionalDonation(
  formData: FormData,
) {
  const parsed = additionalDonationCreateSchema.safeParse({
    amountPaise: rupeesToPaise(formData.get("amount")),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect("/donations?error=invalid_additional_donation");
  }

  try {
    await createAdditionalDonation(parsed.data);
  } catch {
    redirect(
      "/donations?error=additional_donation_failed",
    );
  }

  refreshDonationPaths();
  redirect("/donations?additional=1");
}

export async function beginPaymentReview(formData: FormData) {
  const parsed = donationPaymentReviewSchema.safeParse({
    paymentId: String(formData.get("paymentId") ?? ""),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect("/donations/manage?error=invalid_payment");
  }

  try {
    await startDonationPaymentReview(parsed.data);
  } catch {
    redirect("/donations/manage?error=review_failed");
  }

  refreshDonationPaths();
  redirect("/donations/manage?reviewed=1");
}

export async function rejectPayment(formData: FormData) {
  const parsed = donationPaymentRejectSchema.safeParse({
    paymentId: String(formData.get("paymentId") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect("/donations/manage?error=invalid_rejection");
  }

  try {
    await rejectDonationPayment(parsed.data);
  } catch {
    redirect("/donations/manage?error=rejection_failed");
  }

  refreshDonationPaths();
  redirect("/donations/manage?rejected=1");
}

export async function verifyPayment(formData: FormData) {
  const parsed = donationPaymentVerifySchema.safeParse({
    paymentId: String(formData.get("paymentId") ?? ""),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect("/donations/manage?error=invalid_payment");
  }

  try {
    await verifyAndAllocateDonationPayment(parsed.data);
  } catch {
    redirect("/donations/manage?error=verification_failed");
  }

  refreshDonationPaths();
  redirect("/donations/manage?verified=1");
}

export async function waiveObligation(formData: FormData) {
  const parsed = donationObligationWaiverSchema.safeParse({
    obligationId: String(
      formData.get("obligationId") ?? "",
    ),
    waivedAmountPaise: rupeesToPaise(
      formData.get("waivedAmount"),
    ),
    reason: String(formData.get("reason") ?? "").trim(),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect("/donations/manage?error=invalid_waiver");
  }

  try {
    await waiveDonationObligation(parsed.data);
  } catch {
    redirect("/donations/manage?error=waiver_failed");
  }

  refreshDonationPaths();
  redirect("/donations/manage?waived=1");
}

export async function createObligationRule(
  formData: FormData,
) {
  const parsed =
    donationObligationRuleCreateSchema.safeParse({
      effectiveFromMonth: String(
        formData.get("effectiveMonth") ?? "",
      ),
      monthlyAmountPaise: rupeesToPaise(
        formData.get("monthlyAmount"),
      ),
      operationId: randomUUID(),
    });

  if (!parsed.success) {
    redirect("/donations/manage?error=invalid_rule");
  }

  try {
    await createDonationObligationRule(parsed.data);
  } catch {
    redirect("/donations/manage?error=rule_failed");
  }

  refreshDonationPaths();
  redirect("/donations/manage?rule_created=1");
}

export async function generateObligations(
  formData: FormData,
) {
  const parsed =
    donationObligationGenerationSchema.safeParse({
      effectiveMonth: String(
        formData.get("effectiveMonth") ?? "",
      ),
      operationId: randomUUID(),
    });

  if (!parsed.success) {
    redirect(
      "/donations/manage?error=invalid_generation_month",
    );
  }

  try {
    await generateMonthlyDonationObligations(parsed.data);
  } catch {
    redirect("/donations/manage?error=generation_failed");
  }

  refreshDonationPaths();
  redirect("/donations/manage?generated=1");
}
