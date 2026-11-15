import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptLookupForm } from "./ReceiptLookupForm";

export const metadata: Metadata = {
  title: "Verify a donation receipt | Masjid E Mamoor 2",
  robots: { index: false, follow: false },
};

export default function PublicReceiptLookupPage() {
  return <main className="min-h-screen bg-stone-50 px-5 py-12 text-zinc-900">
    <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-900">Masjid E Mamoor 2</p>
      <h1 className="mt-2 text-3xl font-semibold">Verify a donation receipt</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600">Enter the exact receipt number to see the verified donor, amount, date, payment method, and purpose.</p>
      <ReceiptLookupForm />
      <Link href="/login" className="mt-8 inline-block text-sm text-emerald-900 underline">Member sign in</Link>
    </div>
  </main>;
}
