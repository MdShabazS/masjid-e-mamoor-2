"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseRupeesToPaise } from "@/lib/donations/input";
import { createClient } from "@/lib/supabase/server";

export async function submitReferredDonation(form: FormData) {
  const donorName = String(form.get("donorName") ?? "").trim();
  const paymentMethod = String(form.get("paymentMethod") ?? "");
  const referrerId = String(form.get("referrerId") ?? "");
  const purpose = String(form.get("purpose") ?? "").trim();
  const donationDate = String(form.get("donationDate") ?? "");
  const donorPhone = String(form.get("donorPhone") ?? "").trim();
  const paymentReference = String(form.get("paymentReference") ?? "").trim();
  const replacesId = String(form.get("replacesId") ?? "");
  const amountPaise = parseRupeesToPaise(String(form.get("amount") ?? ""));
  if (!donorName || donorName.length > 160 || amountPaise === null || amountPaise <= 0 ||
      !["cash", "upi", "bank_transfer"].includes(paymentMethod) ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(referrerId) ||
      !purpose || purpose.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(donationDate) ||
      (donorPhone.length > 0 && (donorPhone.length < 6 || donorPhone.length > 25)) ||
      (paymentMethod !== "cash" && !paymentReference) || paymentReference.length > 120 ||
      (replacesId && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(replacesId))) {
    redirect("/donations/referred?error=invalid");
  }
  const client = await createClient();
  const { error } = await client.rpc("submit_referred_donor_contribution", {
    p_donor_name: donorName,
    p_amount_paise: amountPaise,
    p_payment_method: paymentMethod,
    p_operation_id: randomUUID(),
    p_referrer_application_user_id: referrerId,
    p_purpose: purpose,
    p_donation_date: donationDate,
    p_donor_phone: donorPhone || null,
    p_payment_reference: paymentReference || null,
    p_replaces_contribution_id: replacesId || null,
  });
  if (error) redirect("/donations/referred?error=submit");
  revalidatePath("/donations/referred");
  redirect("/donations/referred?submitted=1");
}

export async function decideReferredDonation(form: FormData) {
  const id = String(form.get("id") ?? "");
  const approve = form.get("decision") === "approve";
  const reason = String(form.get("reason") ?? "").trim();
  const accountId = String(form.get("accountId") ?? "");
  const businessDate = String(form.get("businessDate") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) ||
      (approve && (!/^[0-9a-f-]{36}$/i.test(accountId) || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate))) ||
      (!approve && (!reason || reason.length > 1000))) {
    redirect("/donations/referred?error=invalid_decision");
  }
  const client = await createClient();
  const { error } = await client.rpc("decide_referred_donor_contribution", {
    p_contribution_id: id,
    p_approve: approve,
    p_finance_account_id: approve ? accountId : null,
    p_business_date: approve ? businessDate : null,
    p_reason: approve ? null : reason,
    p_operation_id: randomUUID(),
  });
  if (error) redirect("/donations/referred?error=decision");
  revalidatePath("/donations/referred");
  revalidatePath("/activity");
  revalidatePath("/finance");
  redirect(`/donations/referred?${approve ? "verified" : "rejected"}=1`);
}

export async function voidVerifiedDonation(form: FormData) {
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ||
      reason.length < 10 || reason.length > 1000) {
    redirect("/donations/referred?error=invalid_void");
  }
  const client = await createClient();
  const { error } = await client.rpc("void_referred_donor_contribution", {
    p_contribution_id: id,
    p_reason: reason,
    p_operation_id: randomUUID(),
  });
  if (error) redirect("/donations/referred?error=void");
  revalidatePath("/donations/referred");
  revalidatePath("/activity");
  revalidatePath("/finance");
  redirect("/donations/referred?voided=1");
}
