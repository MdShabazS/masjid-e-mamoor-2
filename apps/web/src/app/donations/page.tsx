import Link from "next/link";

import {
  getAdditionalDonations,
  getDonationAllocations,
  getDonationObligations,
  getDonationPayments,
  getDonationWaivers,
} from "@/lib/donations/server";

import {
  getOwnMemberProfile,
  hasPermission,
} from "@/lib/members/server";


import {
  submitAdditionalDonation,
  submitPayment,
  uploadPaymentProof,
} from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function messageFor(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (searchParams.submitted === "1") {
    return {
      kind: "success",
      text: "Payment submitted for verification.",
    };
  }

  if (searchParams.additional === "1") {
    return {
      kind: "success",
      text: "Additional donation recorded.",
    };
  }

  if (searchParams.proof_uploaded === "1") {
    return {
      kind: "success",
      text: "Payment proof uploaded securely.",
    };
  }

  const error = searchParams.error;

  if (typeof error !== "string") {
    return null;
  }

  const messages: Record<string, string> = {
    invalid_payment: "Enter a valid payment amount and method.",
    payment_submit_failed:
      "The payment could not be submitted. Please try again.",
    invalid_additional_donation:
      "Enter a valid additional donation amount.",
    additional_donation_failed:
      "The additional donation could not be recorded.",
    proof_required:
      "Choose a payment proof to upload.",
    invalid_proof:
      "Proof must be a valid JPEG, PNG, or PDF no larger than 5 MiB.",
    proof_upload_failed:
      "The payment proof could not be uploaded. Please try again.",
    proof_registration_pending:
      "The proof reached protected storage but registration could not finish. Submit the same file again to retry safely.",
  };

  return {
    kind: "error",
    text: messages[error] ?? "The donation operation failed.",
  };
}

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const [
    obligations,
    payments,
    allocations,
    waivers,
    additionalDonations,
    ownMemberProfile,
    canUploadProof,
  ] = await Promise.all([
    getDonationObligations(),
    getDonationPayments(),
    getDonationAllocations(),
    getDonationWaivers(),
    getAdditionalDonations(),
    getOwnMemberProfile(),
    hasPermission(
      "donations.payments.proof_upload",
    ),
  ]);

  const allocatedByObligation = new Map<string, number>();
  const waivedByObligation = new Map<string, number>();

  for (const allocation of allocations) {
    allocatedByObligation.set(
      allocation.obligationId,
      (allocatedByObligation.get(allocation.obligationId) ?? 0) +
        allocation.allocatedAmountPaise,
    );
  }

  for (const waiver of waivers) {
    waivedByObligation.set(
      waiver.obligationId,
      (waivedByObligation.get(waiver.obligationId) ?? 0) +
        waiver.waivedAmountPaise,
    );
  }

  const obligationRows = obligations.map((obligation) => {
    const allocated =
      allocatedByObligation.get(obligation.id) ?? 0;
    const waived =
      waivedByObligation.get(obligation.id) ?? 0;

    const outstanding = Math.max(
      0,
      obligation.authoritativeAmountPaise -
        allocated -
        waived,
    );

    return {
      ...obligation,
      allocated,
      waived,
      outstanding,
    };
  });

  const totalOutstanding = obligationRows.reduce(
    (total, obligation) =>
      total + obligation.outstanding,
    0,
  );

  const message = messageFor(params);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Masjid-e-Mamoor
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Donations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            View your monthly obligations, submit payments, and
            review your donation history.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Back to dashboard
        </Link>
      </div>

      {message ? (
        <div
          className={`mb-6 rounded-lg border p-4 text-sm ${
            message.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-5">
          <p className="text-sm text-zinc-500">
            Outstanding
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(totalOutstanding)}
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-sm text-zinc-500">
            Monthly obligations
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {obligations.length}
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-sm text-zinc-500">
            Payments submitted
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {payments.length}
          </p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">
            Submit payment
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Payments remain pending until an authorized reviewer
            verifies them.
          </p>

          <form action={submitPayment} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Amount (₹)
              </span>
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                className="w-full rounded-lg border px-3 py-2"
                placeholder="500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Payment method
              </span>
              <select
                name="paymentMethod"
                required
                className="w-full rounded-lg border px-3 py-2"
                defaultValue="upi"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">
                  Bank transfer
                </option>
                <option value="other">Other</option>
              </select>
            </label>

            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Submit payment
            </button>
          </form>

          <p className="mt-4 text-xs text-zinc-500">
            After submitting a payment, you can attach a JPEG, PNG,
            or PDF proof up to 5 MiB while it is pending review.
          </p>
        </section>

        <section className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">
            Additional donation
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Record a donation separate from your monthly obligation.
          </p>

          <form
            action={submitAdditionalDonation}
            className="mt-5 space-y-4"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Amount (₹)
              </span>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="w-full rounded-lg border px-3 py-2"
                placeholder="100"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Record donation
            </button>
          </form>
        </section>
      </div>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Monthly obligations
        </h2>

        {obligationRows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No donation obligations are currently visible.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pr-4">Month</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Allocated</th>
                  <th className="pb-3 pr-4">Waived</th>
                  <th className="pb-3 pr-4">Outstanding</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {obligationRows.map((obligation) => (
                  <tr
                    key={obligation.id}
                    className="border-b last:border-0"
                  >
                    <td className="py-3 pr-4">
                      {formatMonth(obligation.effectiveMonth)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatMoney(
                        obligation.authoritativeAmountPaise,
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {formatMoney(obligation.allocated)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatMoney(obligation.waived)}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      {formatMoney(obligation.outstanding)}
                    </td>
                    <td className="py-3 capitalize">
                      {obligation.status.replaceAll("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Payment history
        </h2>

        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No payments have been submitted.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Method</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Allocated</th>
                  <th className="pb-3">Proof</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const allocated = allocations
                    .filter(
                      (allocation) =>
                        allocation.paymentId === payment.id,
                    )
                    .reduce(
                      (total, allocation) =>
                        total +
                        allocation.allocatedAmountPaise,
                      0,
                    );

                  return (
                    <tr
                      key={payment.id}
                      className="border-b last:border-0"
                    >
                      <td className="py-3 pr-4">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="py-3 pr-4">
                        {formatMoney(payment.amountPaise)}
                      </td>
                      <td className="py-3 pr-4 capitalize">
                        {payment.paymentMethod.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>
                      <td className="py-3 pr-4 capitalize">
                        {payment.status.replaceAll("_", " ")}
                        {payment.rejectionReason
                          ? ` — ${payment.rejectionReason}`
                          : ""}
                      </td>
                      <td className="py-3 pr-4">
                        {formatMoney(allocated)}
                      </td>
                      <td className="py-3">
                        {canUploadProof &&
                        ownMemberProfile?.id ===
                          payment.memberProfileId &&
                        (payment.status === "submitted" ||
                          payment.status === "under_review") ? (
                          <form
                            action={uploadPaymentProof}
                            className="flex min-w-56 flex-col gap-2"
                          >
                            <input
                              type="hidden"
                              name="paymentId"
                              value={payment.id}
                            />
                            <input
                              type="file"
                              name="proof"
                              accept="image/jpeg,image/png,application/pdf"
                              required
                              className="block text-xs"
                            />
                            <button
                              type="submit"
                              className="w-fit rounded border px-3 py-1 text-xs font-medium"
                            >
                              Upload proof
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            {payment.status === "submitted" ||
                            payment.status === "under_review"
                              ? "Not available"
                              : "Closed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">
          Additional donation history
        </h2>

        {additionalDonations.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No additional donations are currently visible.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {additionalDonations.map((donation) => (
              <div
                key={donation.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium capitalize">
                    {donation.donationKind.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(donation.createdAt)}
                  </p>
                </div>

                <p className="font-semibold">
                  {formatMoney(donation.amountPaise)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
