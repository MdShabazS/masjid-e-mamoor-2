import { randomUUID } from "expo-crypto";
import { EncodingType, StorageAccessFramework } from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import type { MobileAccount } from "../auth/types";
import { parseRupeesToPaise } from "./donation-presentation";
import { pdfBytesToBase64 } from "./finance-date-range";

export interface ReferredDonation {
  id: string;
  donorName: string;
  amountPaise: number;
  paymentMethod: string;
  status: string;
  receiptNumber: string | null;
  rejectionReason: string | null;
  voidReason: string | null;
  createdAt: string;
  referrerId: string;
  purpose: string;
  donationDate: string;
  donorPhone: string | null;
  paymentReference: string | null;
  replacesId: string | null;
  submitterId: string;
}

export interface DonationReferrer { id: string; displayName: string }

export async function listDonationReferrers(): Promise<DonationReferrer[]> {
  const { data, error } = await supabase.rpc("list_donation_referrers");
  if (error) throw new Error("referrers_unavailable");
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.application_user_id), displayName: String(row.display_name),
  }));
}

export async function canReviewReferredDonations(account: MobileAccount) {
  if (account.role !== "finance") return false;
  const { data, error } = await supabase.rpc("has_application_permission", {
    requested_permission: "donations.payments.verify",
  });
  if (error) throw new Error("permission_unavailable");
  return data === true;
}

export async function listReferredDonations(): Promise<ReferredDonation[]> {
  const { data, error } = await supabase.from("referred_donor_contributions")
    .select("id,donor_name,amount_paise,payment_method,status,receipt_number,rejection_reason,void_reason,created_at,referred_by_application_user_id,purpose,donation_date,donor_phone,payment_reference,replaces_contribution_id,submitted_by_application_user_id")
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("referred_donations_unavailable");
  return (data ?? []).map(row => ({
    id: String(row.id), donorName: String(row.donor_name), amountPaise: Number(row.amount_paise),
    paymentMethod: String(row.payment_method), status: String(row.status),
    receiptNumber: row.receipt_number == null ? null : String(row.receipt_number),
    rejectionReason: row.rejection_reason == null ? null : String(row.rejection_reason),
    voidReason: row.void_reason == null ? null : String(row.void_reason),
    createdAt: String(row.created_at),
    referrerId: String(row.referred_by_application_user_id), purpose: String(row.purpose),
    donationDate: String(row.donation_date),
    donorPhone: row.donor_phone == null ? null : String(row.donor_phone),
    paymentReference: row.payment_reference == null ? null : String(row.payment_reference),
    replacesId: row.replaces_contribution_id == null ? null : String(row.replaces_contribution_id),
    submitterId: String(row.submitted_by_application_user_id),
  }));
}

export async function submitReferredDonation(donorName: string, amount: string, method: string,
  referrerId: string, purpose: string, donationDate: string, phone: string, paymentReference: string,
  replacesId: string | null = null) {
  const paise = parseRupeesToPaise(amount);
  if (!donorName.trim() || donorName.trim().length > 160 || paise === null || paise <= 0 ||
    !["cash", "upi", "bank_transfer"].includes(method) ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(referrerId) ||
    !purpose.trim() || purpose.trim().length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(donationDate) ||
    (phone.trim().length > 0 && (phone.trim().length < 6 || phone.trim().length > 25)) ||
    (method !== "cash" && !paymentReference.trim()) || paymentReference.trim().length > 120 ||
    (replacesId !== null && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(replacesId)))
    throw new Error("invalid_donation");
  const { error } = await supabase.rpc("submit_referred_donor_contribution", {
    p_donor_name: donorName.trim(), p_amount_paise: paise, p_payment_method: method,
    p_operation_id: randomUUID(),
    p_referrer_application_user_id: referrerId, p_purpose: purpose.trim(), p_donation_date: donationDate,
    p_donor_phone: phone.trim() || null, p_payment_reference: paymentReference.trim() || null,
    p_replaces_contribution_id: replacesId,
  });
  if (error) throw new Error("donation_submission_failed");
}

export async function decideReferredDonation(id: string, approve: boolean,
  accountId: string | null, businessDate: string | null, reason: string | null) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ||
    (approve && (!accountId || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate ?? ""))) ||
    (!approve && (!reason?.trim() || reason.trim().length > 1000))) throw new Error("invalid_decision");
  const { error } = await supabase.rpc("decide_referred_donor_contribution", {
    p_contribution_id: id, p_approve: approve, p_finance_account_id: approve ? accountId : null,
    p_business_date: approve ? businessDate : null, p_reason: approve ? null : reason?.trim(),
    p_operation_id: randomUUID(),
  });
  if (error) throw new Error("donation_decision_failed");
}

export async function voidVerifiedReferredDonation(id: string, reason: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ||
    reason.trim().length < 10 || reason.trim().length > 1000) throw new Error("invalid_void");
  const { error } = await supabase.rpc("void_referred_donor_contribution", {
    p_contribution_id: id, p_reason: reason.trim(), p_operation_id: randomUUID(),
  });
  if (error) throw new Error("donation_void_failed");
}

export async function saveReferredDonationReceipt(id: string, receiptNumber: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ||
    !/^MEM2-\d{4}-\d{8,}$/.test(receiptNumber)) throw new Error("invalid_receipt");
  const { data, error } = await supabase.functions.invoke("render-referred-donor-receipt", { body: { id } });
  if (error || !data || typeof data.arrayBuffer !== "function") throw new Error("receipt_unavailable");
  const bytes = new Uint8Array(await (data as Blob).arrayBuffer());
  if (bytes.length < 6 || bytes.length > 1024 * 1024 ||
      bytes.slice(0, 5).some((v, i) => v !== [37, 80, 68, 70, 45][i])) throw new Error("invalid_receipt_pdf");
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return false;
  const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, receiptNumber, "application/pdf");
  await StorageAccessFramework.writeAsStringAsync(uri, pdfBytesToBase64(bytes), { encoding: EncodingType.Base64 });
  return true;
}
