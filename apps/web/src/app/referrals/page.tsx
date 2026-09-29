import { randomUUID } from "node:crypto";

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  canManageReferrals,
  canUseReferrals,
  listOwnReferrals,
  listReferralOnboardingRequests,
} from "@/lib/referrals/server";
import {
  approveReferralAction,
  createReferralAction,
  rejectReferralAction,
} from "./actions";
import { ReferralProvisionForm } from "./ReferralProvisionForm";
import { AppShell } from "@/components/AppShell";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-zinc-300 px-2 py-1 text-xs font-medium capitalize text-zinc-700">
      {status}
    </span>
  );
}

async function baseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export default async function ReferralsPage() {
  const [canOpen, canManage, origin] = await Promise.all([
    canUseReferrals(),
    canManageReferrals(),
    baseUrl(),
  ]);

  if (!canOpen) redirect("/dashboard");

  const [ownReferrals, reviewRequests] = await Promise.all([
    listOwnReferrals(),
    canManage ? listReferralOnboardingRequests() : Promise.resolve([]),
  ]);

  return (
    <AppShell><main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              Masjid E Mamoor 2
            </p>
            <h1 className="page-title">
              Member Referrals
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="button-secondary"
          >
            Dashboard
          </Link>
        </header>

        <section className="surface mt-8 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">My referral links</h2>
            <form action={createReferralAction}>
              <button
                type="submit"
                className="button-primary"
              >
                Create referral
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-3">
            {ownReferrals.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No referral links created yet.
              </p>
            ) : (
              ownReferrals.map((referral) => {
                const joinUrl = `${origin}/join/${referral.referralCode}`;
                return (
                  <div
                    key={referral.id}
                    className="rounded-lg border border-zinc-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={referral.status} />
                          <span className="text-xs text-zinc-500">
                            {new Date(referral.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 break-all font-mono text-sm">
                          {joinUrl}
                        </p>
                      </div>
                      <Link
                        href={`/join/${referral.referralCode}`}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                      >
                        Open
                      </Link>
                    </div>
                    {referral.applicantDisplayName ? (
                      <p className="mt-3 text-sm text-zinc-700">
                        Applicant: {referral.applicantDisplayName}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {canManage ? (
          <section className="surface mt-8 p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Onboarding requests</h2>
            <div className="mt-5 grid gap-3">
              {reviewRequests.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  No onboarding requests yet.
                </p>
              ) : (
                reviewRequests.map((referral) => (
                  <div
                    key={referral.id}
                    className="rounded-lg border border-zinc-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={referral.status} />
                          <span className="text-xs text-zinc-500">
                            {referral.submittedAt
                              ? new Date(referral.submittedAt).toLocaleString()
                              : new Date(referral.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 font-medium">
                          {referral.applicantDisplayName ?? "Not submitted"}
                        </p>
                        <p className="text-sm text-zinc-600">
                          {referral.applicantPhone ?? "No contact submitted"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">
                          Referrer: {referral.referrerDisplayName ?? "Unknown"}
                        </p>
                      </div>

                      {referral.status === "submitted" ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={approveReferralAction}>
                            <input
                              type="hidden"
                              name="referralId"
                              value={referral.id}
                            />
                            <input
                              type="hidden"
                              name="operationId"
                              value={randomUUID()}
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={rejectReferralAction}>
                            <input
                              type="hidden"
                              name="referralId"
                              value={referral.id}
                            />
                            <input
                              type="hidden"
                              name="operationId"
                              value={randomUUID()}
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>

                    {referral.status === "approved" ? (
                      <ReferralProvisionForm
                        referralId={referral.id}
                        operationId={randomUUID()}
                      />
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main></AppShell>
  );
}
