import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getDonationManagementCapabilities,
  getDonationObligationRules,
  getDonationObligations,
  getDonationPayments,
  getDonationWaivers,
} from "@/lib/donations/server";

import {
  beginPaymentReview,
  createObligationRule,
  generateObligations,
  rejectPayment,
  recordAnonymousDonation,
  verifyPayment,
  waiveObligation,
} from "../actions";

type SearchParams =
  Promise<Record<string, string | string[] | undefined>>;

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(paise / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function messageFor(
  params: Record<string, string | string[] | undefined>,
) {
  const successMessages: Array<[string, string]> = [
    ["reviewed", "Payment moved to review."],
    ["verified", "Payment verified and allocated."],
    ["rejected", "Payment rejected."],
    ["waived", "Obligation waiver recorded."],
    ["rule_created", "Monthly obligation rule created."],
    ["generated", "Monthly obligations generated."],
    ["anonymous_created", "Anonymous donation recorded."],
  ];

  for (const [key, text] of successMessages) {
    if (params[key] === "1") {
      return { kind: "success", text };
    }
  }

  const error = params.error;

  if (typeof error !== "string") return null;

  const errors: Record<string, string> = {
    invalid_payment: "Invalid payment.",
    review_failed: "Payment could not be moved to review.",
    invalid_rejection: "Enter a valid rejection reason.",
    rejection_failed: "Payment could not be rejected.",
    verification_failed:
      "Payment could not be verified and allocated.",
    invalid_waiver: "Enter valid waiver details.",
    waiver_failed: "The waiver could not be recorded.",
    invalid_rule: "Enter a valid obligation rule.",
    rule_failed: "The obligation rule could not be created.",
    invalid_generation_month:
      "Select a valid obligation month.",
    generation_failed:
      "Monthly obligations could not be generated.",
    invalid_anonymous_donation:
      "Enter a valid anonymous donation amount.",
    anonymous_donation_failed:
      "The anonymous donation could not be recorded.",
  };

  return {
    kind: "error",
    text: errors[error] ?? "The donation operation failed.",
  };
}

export default async function DonationManagementPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const capabilities =
    await getDonationManagementCapabilities();

  if (
    !capabilities.canVerify &&
    !capabilities.canManageObligations &&
    !capabilities.canCreateAnonymousDonation
  ) {
    redirect("/donations");
  }

  const [payments, obligations, waivers, rules] =
    await Promise.all([
      getDonationPayments(),
      getDonationObligations(),
      getDonationWaivers(),
      getDonationObligationRules(),
    ]);

  const message = messageFor(params);

  const submitted = payments.filter(
    (payment) => payment.status === "submitted",
  );

  const underReview = payments.filter(
    (payment) => payment.status === "under_review",
  );

  const waivedByObligation = new Map<string, number>();

  for (const waiver of waivers) {
    waivedByObligation.set(
      waiver.obligationId,
      (waivedByObligation.get(waiver.obligationId) ?? 0) +
        waiver.waivedAmountPaise,
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Masjid-e-Mamoor
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Donation Management
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Review payments and administer monthly donation
            obligations within your authorized permissions.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/donations"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Donations
          </Link>

          <Link
            href="/dashboard"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Dashboard
          </Link>
        </div>
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
            Submitted
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {submitted.length}
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-sm text-zinc-500">
            Under review
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {underReview.length}
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-sm text-zinc-500">
            Obligations
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {obligations.length}
          </p>
        </div>
      </section>

      {capabilities.canCreateAnonymousDonation ? (
        <section className="mb-8 rounded-xl border p-6">
          <h2 className="text-xl font-semibold">
            Anonymous donation
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            The donor identity is not stored. The authenticated staff
            operator is retained for audit.
          </p>

          <form
            action={recordAnonymousDonation}
            className="mt-5 flex flex-wrap items-end gap-3"
          >
            <label className="block min-w-64 flex-1">
              <span className="mb-1 block text-sm font-medium">
                Amount (₹)
              </span>

              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                required
                className="w-full rounded-lg border px-3 py-2"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Record anonymous donation
            </button>
          </form>
        </section>
      ) : null}

      {capabilities.canVerify ? (
        <section className="rounded-xl border p-6">
          <h2 className="text-xl font-semibold">
            Payment review queue
          </h2>

          {submitted.length === 0 &&
          underReview.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              No payments currently require review.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {[...submitted, ...underReview].map(
                (payment) => (
                  <article
                    key={payment.id}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">
                          {formatMoney(payment.amountPaise)}
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                          {payment.paymentMethod.replaceAll(
                            "_",
                            " ",
                          )}{" "}
                          · {formatDate(payment.createdAt)}
                        </p>

                        <p className="mt-1 text-sm capitalize">
                          {payment.status.replaceAll("_", " ")}
                        </p>
                      </div>

                      {payment.status === "submitted" ? (
                        <form action={beginPaymentReview}>
                          <input
                            type="hidden"
                            name="paymentId"
                            value={payment.id}
                          />

                          <button
                            type="submit"
                            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                          >
                            Start review
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {payment.status === "under_review" ? (
                      <div className="mt-5 grid gap-4 border-t pt-4 lg:grid-cols-2">
                        {capabilities.canVerifyAndAllocate ? (
                          <form action={verifyPayment}>
                            <input
                              type="hidden"
                              name="paymentId"
                              value={payment.id}
                            />

                            <button
                              type="submit"
                              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                            >
                              Verify and allocate
                            </button>
                          </form>
                        ) : null}

                        <form
                          action={rejectPayment}
                          className="flex flex-wrap gap-2"
                        >
                          <input
                            type="hidden"
                            name="paymentId"
                            value={payment.id}
                          />

                          <input
                            name="reason"
                            required
                            maxLength={500}
                            placeholder="Rejection reason"
                            className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm"
                          />

                          <button
                            type="submit"
                            className="rounded-lg border px-4 py-2 text-sm font-medium"
                          >
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      ) : null}

      {capabilities.canManageObligations ? (
        <>
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border p-6">
              <h2 className="text-xl font-semibold">
                Create monthly rule
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Set the authoritative recurring donation amount
                beginning with a specific calendar month.
              </p>

              <form
                action={createObligationRule}
                className="mt-5 space-y-4"
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
                    Effective month
                  </span>

                  <input
                    type="month"
                    name="effectiveMonth"
                    required
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
                    Monthly amount (₹)
                  </span>

                  <input
                    type="number"
                    name="monthlyAmount"
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Create rule
                </button>
              </form>
            </div>

            <div className="rounded-xl border p-6">
              <h2 className="text-xl font-semibold">
                Generate monthly obligations
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Generate obligations for active members using the
                authoritative rule effective for the selected month.
              </p>

              <form
                action={generateObligations}
                className="mt-5 space-y-4"
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
                    Obligation month
                  </span>

                  <input
                    type="month"
                    name="effectiveMonth"
                    required
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Generate obligations
                </button>
              </form>
            </div>
          </section>

          <section className="mt-8 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Obligation administration
            </h2>

            {obligations.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No obligations are currently visible.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {obligations.map((obligation) => {
                  const waived =
                    waivedByObligation.get(obligation.id) ?? 0;

                  return (
                    <article
                      key={obligation.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {obligation.effectiveMonth}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {formatMoney(
                              obligation.authoritativeAmountPaise,
                            )}{" "}
                            · {obligation.status.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Waived: {formatMoney(waived)}
                          </p>
                        </div>
                      </div>

                      {obligation.status !== "paid" &&
                      obligation.status !== "waived" ? (
                        <form
                          action={waiveObligation}
                          className="mt-4 flex flex-wrap gap-2 border-t pt-4"
                        >
                          <input
                            type="hidden"
                            name="obligationId"
                            value={obligation.id}
                          />

                          <input
                            type="number"
                            name="waivedAmount"
                            min="0.01"
                            step="0.01"
                            required
                            placeholder="Waiver amount ₹"
                            className="rounded-lg border px-3 py-2 text-sm"
                          />

                          <input
                            name="reason"
                            required
                            maxLength={500}
                            placeholder="Reason"
                            className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm"
                          />

                          <button
                            type="submit"
                            className="rounded-lg border px-4 py-2 text-sm font-medium"
                          >
                            Record waiver
                          </button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-8 rounded-xl border p-6">
            <h2 className="text-xl font-semibold">
              Obligation rules
            </h2>

            {rules.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                No rules have been configured.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap justify-between gap-3 border-b pb-3 last:border-0"
                  >
                    <span>{rule.effectiveFromMonth}</span>
                    <span className="font-medium">
                      {formatMoney(rule.monthlyAmountPaise)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
