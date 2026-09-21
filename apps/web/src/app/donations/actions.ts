"use server";

import { createHash, randomUUID } from "node:crypto";
import {
  DONATION_PROOF_BUCKET,
  donationProofExtension,
  parseRupeesToPaise,
  validateDonationProofBytes,
  validateDonationProofFile,
} from "@/lib/donations/input";

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
import { createClient } from "@/lib/supabase/server";

function refreshDonationPaths() {
  revalidatePath("/donations");
  revalidatePath("/donations/manage");
  revalidatePath("/dashboard");
}

export async function submitPayment(formData: FormData) {
  const parsed = donationPaymentSubmitSchema.safeParse({
    amountPaise: parseRupeesToPaise(String(formData.get("amount") ?? "")) ?? Number.NaN,
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
    amountPaise: parseRupeesToPaise(String(formData.get("amount") ?? "")) ?? Number.NaN,
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
    waivedAmountPaise: parseRupeesToPaise(
      String(formData.get("waivedAmount") ?? ""),
    ) ?? Number.NaN,
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
      monthlyAmountPaise: parseRupeesToPaise(
        String(formData.get("monthlyAmount") ?? ""),
      ) ?? Number.NaN,
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


export async function uploadPaymentProof(
  formData: FormData,
) {
  const paymentId = String(
    formData.get("paymentId") ?? "",
  ).trim();

  const proof = formData.get("proof");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      paymentId,
    )
  ) {
    redirect("/donations?error=invalid_payment");
  }

  if (!(proof instanceof File)) {
    redirect("/donations?error=proof_required");
  }

  const validationError =
    validateDonationProofFile(proof);

  if (validationError) {
    redirect("/donations?error=invalid_proof");
  }

  const extension =
    donationProofExtension(proof.type);

  if (!extension) {
    redirect("/donations?error=invalid_proof");
  }

  const bytes = new Uint8Array(
    await proof.arrayBuffer(),
  );

  const contentError =
    validateDonationProofBytes(
      proof.type,
      bytes,
    );

  if (contentError) {
    redirect("/donations?error=invalid_proof");
  }

  const digest = createHash("sha256")
    .update(bytes)
    .digest("hex");

  const objectId = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32),
  ].join("-");

  const objectPath =
    `${paymentId}/${objectId}.${extension}`;

  const supabase = await createClient();

  async function proofIsRegistered() {
    const { data, error } = await supabase
      .from("donation_payment_proofs")
      .select("id")
      .eq("payment_id", paymentId)
      .eq(
        "storage_object_path",
        objectPath,
      )
      .maybeSingle();

    return !error && Boolean(data);
  }

  async function registerProof() {
    const { error } = await supabase.rpc(
      "register_donation_payment_proof",
      {
        p_payment_id: paymentId,
        p_storage_object_path: objectPath,
      },
    );

    if (!error) {
      return true;
    }

    return proofIsRegistered();
  }

  const { error: uploadError } =
    await supabase.storage
      .from(DONATION_PROOF_BUCKET)
      .upload(objectPath, bytes, {
        contentType: proof.type,
        cacheControl: "3600",
        upsert: false,
      });

  if (uploadError) {
    if (await proofIsRegistered()) {
      refreshDonationPaths();
      redirect(
        "/donations?proof_uploaded=1",
      );
    }

    if (await registerProof()) {
      refreshDonationPaths();
      redirect(
        "/donations?proof_uploaded=1",
      );
    }

    redirect(
      "/donations?error=proof_upload_failed",
    );
  }

  if (!(await registerProof())) {
    /*
     * The object is immutable and cannot be deleted by
     * the authenticated uploader. Because the object path
     * is deterministic for this payment + file content,
     * submitting the same proof again can safely repair
     * metadata registration without creating another
     * Storage object.
     */
    redirect(
      "/donations?error=proof_registration_pending",
    );
  }

  refreshDonationPaths();
  redirect("/donations?proof_uploaded=1");
}
