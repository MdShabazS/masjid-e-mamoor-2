import { randomUUID } from "node:crypto";

import Link from "next/link";
import { validateReferralCode } from "@/lib/referrals/server";
import { submitOnboardingRequestAction } from "./actions";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const referral = await validateReferralCode(code);
  const submitted = query.submitted === "1";

  return (
    <main className="auth-shell min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-lg">
        <header>
          <p className="eyebrow">
            Masjid E Mamoor 2
          </p>
          <h1 className="page-title">Member Referral</h1>
        </header>

        <section className="auth-card mt-8 p-6 sm:p-8">
          {submitted ? (
            <div>
              <h2 className="text-lg font-semibold">Request submitted</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Your onboarding request has been sent for review. An account
                will be provided only after approval.
              </p>
            </div>
          ) : referral.valid ? (
            <form action={submitOnboardingRequestAction} className="grid gap-4">
              <input type="hidden" name="referralCode" value={code} />
              <input type="hidden" name="operationId" value={randomUUID()} />
              <div>
                <h2 className="text-lg font-semibold">Request membership</h2>
                {referral.referrerDisplayName ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    Referred by {referral.referrerDisplayName}
                  </p>
                ) : null}
              </div>

              {query.error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  This request could not be submitted. Check the details or
                  contact the Masjid administrator.
                </p>
              ) : null}

              <label className="grid gap-1 text-sm">
                Name
                <input
                  name="displayName"
                  required
                  maxLength={120}
                  className="field-input"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Phone
                <input
                  name="phone"
                  required
                  inputMode="tel"
                  placeholder="+919876543210"
                  className="field-input"
                />
              </label>

              <button
                type="submit"
                className="button-primary"
              >
                Submit request
              </button>
            </form>
          ) : (
            <div>
              <h2 className="text-lg font-semibold">
                Referral unavailable
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                This referral cannot be used for a new onboarding request.
              </p>
            </div>
          )}
        </section>

        <p className="mt-6 text-sm">
          <Link href="/login" className="font-medium underline">
            Already have an account?
          </Link>
        </p>
      </div>
    </main>
  );
}
