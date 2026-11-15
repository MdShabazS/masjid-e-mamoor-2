import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/lib/accounts/server";
import { getActiveFinanceAccounts } from "@/lib/finance/server";
import { decideReferredDonation, submitReferredDonation, voidVerifiedDonation } from "./actions";

type Contribution = {
  id: string; donor_name: string; amount_paise: number; payment_method: string;
  status: string; receipt_number: string | null; rejection_reason: string | null;
  created_at: string; business_date: string | null; referred_by_application_user_id: string;
  purpose: string; donation_date: string;
  donor_phone: string | null; payment_reference: string | null;
  replaces_contribution_id: string | null; submitted_by_application_user_id: string;
  void_reason: string | null;
};

const money = (paise: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR",
}).format(paise / 100);

export default async function ReferredDonationsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  const client = await createClient();
  const [{ data: canVerify, error: permissionError }, { data: referrers, error: referrerError }, { data: records, error }, params] = await Promise.all([
    client.rpc("has_application_permission", { requested_permission: "donations.payments.verify" }),
    client.rpc("list_donation_referrers"),
    client.from("referred_donor_contributions")
      .select("id,donor_name,amount_paise,payment_method,status,receipt_number,rejection_reason,created_at,business_date,referred_by_application_user_id,purpose,donation_date,donor_phone,payment_reference,replaces_contribution_id,submitted_by_application_user_id,void_reason")
      .order("created_at", { ascending: false }).limit(200),
    searchParams,
  ]);
  if (permissionError || referrerError || error) throw new Error("Donation records unavailable.");
  const people = (referrers ?? []) as { application_user_id: string; display_name: string }[];
  const treasurerCanVerify = canVerify === true && account.role === "finance";
  const accounts = treasurerCanVerify ? await getActiveFinanceAccounts() : [];
  const rows = (records ?? []) as Contribution[];
  const message = params.submitted ? "Donation submitted for verification. No amount has been posted yet."
    : params.verified ? "Donation verified and posted to Finance. Receipt is available."
    : params.rejected ? "Donation rejected; no amount was posted."
    : params.voided ? "Receipt voided. A dated reversal has been posted; submit a corrected donation for new verification."
    : params.error ? "The request could not be completed. Check the details and try again." : null;
  return <main className="mx-auto max-w-5xl px-6 py-10">
    <Link className="text-sm text-emerald-800 underline" href="/donations">← Donations</Link>
    <p className="mt-6 text-sm font-semibold text-emerald-800">Masjid E Mamoor 2</p>
    <h1 className="mt-1 text-3xl font-semibold">Donations from referred donors</h1>
    <p className="mt-2 text-zinc-600">Record who brought the donor separately from who enters the donation. Finance and member activity update after verification.</p>
    {message && <p role="status" className="mt-5 rounded-lg border p-4">{message}</p>}
    <section className="mt-8 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Submit a donation</h2>
      <form action={submitReferredDonation} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>Donor name<input required maxLength={160} name="donorName" className="mt-1 w-full rounded border p-2" /></label>
        <label>Amount (₹)<input required type="number" step="0.01" min="0.01" name="amount" className="mt-1 w-full rounded border p-2" /></label>
        <label>Payment method<select name="paymentMethod" className="mt-1 w-full rounded border p-2"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option></select></label>
        <label>Member who brought the donor<select name="referrerId" required className="mt-1 w-full rounded border p-2"><option value="">Select member</option>{people.map(person => <option key={person.application_user_id} value={person.application_user_id}>{person.display_name}</option>)}</select></label>
        <label>Donation date<input name="donationDate" type="date" required defaultValue={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} className="mt-1 w-full rounded border p-2" /></label>
        <label>Purpose<input name="purpose" required maxLength={200} list="donation-purposes" className="mt-1 w-full rounded border p-2" /><datalist id="donation-purposes"><option value="General donation"/><option value="Maintenance"/><option value="Education"/><option value="Jummah collection"/></datalist></label>
        <label>Donor phone (optional)<input name="donorPhone" maxLength={25} className="mt-1 w-full rounded border p-2" /></label>
        <label>UPI or bank reference (required for those methods)<input name="paymentReference" maxLength={120} className="mt-1 w-full rounded border p-2" /></label>
        <button className="self-end rounded bg-emerald-800 px-4 py-2 text-white">Submit for verification</button>
      </form>
    </section>
    <section className="mt-8 space-y-4"><h2 className="text-xl font-semibold">Recent submissions</h2>
      {rows.length === 0 && <p>No donations submitted yet.</p>}
      {rows.map(row => <article key={row.id} className="rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">{row.donor_name} · {money(Number(row.amount_paise))}</h3>
            <p className="text-sm text-zinc-600">{row.payment_method.replaceAll("_", " ")} · {row.donation_date} · {row.purpose} · Referred by {people.find(person => person.application_user_id === row.referred_by_application_user_id)?.display_name ?? "Member"} · {row.status}</p></div>
          {row.status === "verified" && row.receipt_number && <Link className="rounded border px-3 py-2 text-sm" href={`/donations/referred/${row.id}/receipt`}>Download receipt PDF</Link>}
        </div>
        {row.rejection_reason && <p className="mt-3 text-sm text-red-700">Reason: {row.rejection_reason}</p>}
        {row.void_reason && <p className="mt-3 text-sm text-red-700">Voided receipt {row.receipt_number}: {row.void_reason}</p>}
        {row.replaces_contribution_id && <p className="mt-2 text-sm text-zinc-600">Correction of an earlier rejected or voided submission.</p>}
        {treasurerCanVerify && row.status === "verified" && <form action={voidVerifiedDonation} className="mt-4 space-y-2 border-t pt-4">
          <input type="hidden" name="id" value={row.id}/>
          <label className="block text-sm">Void reason (at least 10 characters)<textarea required minLength={10} maxLength={1000} name="reason" className="mt-1 w-full rounded border p-2"/></label>
          <button className="rounded border border-red-300 px-4 py-2 text-sm text-red-800">Void receipt and reverse posting</button>
        </form>}
        {(row.status === "rejected" || row.status === "voided") && row.submitted_by_application_user_id === account.id &&
          !rows.some(revision => revision.replaces_contribution_id === row.id) &&
          <form action={submitReferredDonation} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
            <input type="hidden" name="replacesId" value={row.id}/>
            <label>Correct donor name<input name="donorName" required maxLength={160} defaultValue={row.donor_name} className="mt-1 w-full rounded border p-2"/></label>
            <label>Amount (₹)<input name="amount" type="number" required min="0.01" step="0.01" defaultValue={(Number(row.amount_paise) / 100).toFixed(2)} className="mt-1 w-full rounded border p-2"/></label>
            <label>Payment method<select name="paymentMethod" defaultValue={row.payment_method} className="mt-1 w-full rounded border p-2"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option></select></label>
            <label>Member who brought the donor<select name="referrerId" required defaultValue={row.referred_by_application_user_id} className="mt-1 w-full rounded border p-2">{people.map(person => <option key={person.application_user_id} value={person.application_user_id}>{person.display_name}</option>)}</select></label>
            <label>Donation date<input name="donationDate" type="date" required defaultValue={row.donation_date} className="mt-1 w-full rounded border p-2"/></label>
            <label>Purpose<input name="purpose" required maxLength={200} defaultValue={row.purpose} className="mt-1 w-full rounded border p-2"/></label>
            <label>Donor phone<input name="donorPhone" maxLength={25} defaultValue={row.donor_phone ?? ""} className="mt-1 w-full rounded border p-2"/></label>
            <label>UPI or bank reference<input name="paymentReference" maxLength={120} defaultValue={row.payment_reference ?? ""} className="mt-1 w-full rounded border p-2"/></label>
            <button className="self-end rounded bg-emerald-800 px-4 py-2 text-white">Submit correction for verification</button>
          </form>}
        {treasurerCanVerify && row.status === "submitted" && <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
          <form action={decideReferredDonation} className="space-y-2">
            <input type="hidden" name="id" value={row.id}/><input type="hidden" name="decision" value="approve"/>
            <label className="block">Account<select name="accountId" required className="mt-1 w-full rounded border p-2"><option value="">Select account</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="block">Business date<input type="date" required name="businessDate" defaultValue={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} className="mt-1 w-full rounded border p-2"/></label>
            <button className="rounded bg-emerald-800 px-4 py-2 text-white">Verify and post</button>
          </form>
          <form action={decideReferredDonation} className="space-y-2">
            <input type="hidden" name="id" value={row.id}/><input type="hidden" name="decision" value="reject"/>
            <label className="block">Reason<textarea required name="reason" maxLength={1000} className="mt-1 w-full rounded border p-2"/></label>
            <button className="rounded border px-4 py-2">Reject</button>
          </form>
        </div>}
      </article>)}
    </section>
  </main>;
}
