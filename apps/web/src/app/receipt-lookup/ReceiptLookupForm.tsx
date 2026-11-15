"use client";

import { useActionState } from "react";
import { lookupVerifiedReceipt, type ReceiptLookupState } from "./actions";

const initialState: ReceiptLookupState = { receipt: null, message: null };

export function ReceiptLookupForm() {
  const [state, action, pending] = useActionState(lookupVerifiedReceipt, initialState);
  const receipt = state.receipt;
  return <>
    <form action={action} className="mt-6 flex flex-col gap-3 sm:flex-row">
      <label className="flex-1 text-sm font-medium text-zinc-800">Receipt number
        <input name="receiptNumber" required maxLength={40} autoComplete="off" placeholder="MEM2-2026-00000001"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 uppercase" />
      </label>
      <button disabled={pending} className="self-end rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white disabled:opacity-60">
        {pending ? "Checking…" : "Verify receipt"}
      </button>
    </form>
    {state.message && <p role="status" className="mt-5 rounded-lg border border-zinc-200 p-4 text-sm">{state.message}</p>}
    {receipt && <section aria-label="Verified donation receipt" className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-900">Verified donation</p>
      <h2 className="mt-1 text-2xl font-semibold text-emerald-950">{receipt.receiptNumber}</h2>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-zinc-600">Donor</dt><dd className="font-medium">{receipt.donorName}</dd></div>
        <div><dt className="text-zinc-600">Amount</dt><dd className="font-medium">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(receipt.amountPaise / 100)}</dd></div>
        <div><dt className="text-zinc-600">Donation date</dt><dd className="font-medium">{receipt.donationDate}</dd></div>
        <div><dt className="text-zinc-600">Method</dt><dd className="font-medium">{receipt.paymentMethod.replaceAll("_", " ").toUpperCase()}</dd></div>
        <div><dt className="text-zinc-600">Purpose</dt><dd className="font-medium">{receipt.purpose}</dd></div>
        <div><dt className="text-zinc-600">Verified at</dt><dd className="font-medium">{new Date(receipt.verifiedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</dd></div>
      </dl>
      <p className="mt-5 text-xs text-zinc-600">This confirms that the donation was verified and posted to Masjid E Mamoor 2. It does not certify tax deduction eligibility.</p>
    </section>}
  </>;
}
