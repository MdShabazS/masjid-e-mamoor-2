import { changePassword } from "./actions";

type ChangePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid_password";

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <section className="auth-card w-full max-w-md p-8 sm:p-10">
        <div className="mb-8">
          <p className="eyebrow">
            Masjid-e-Mamoor
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-emerald-950">
            Change password
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Set a new password before continuing. Use at least 10 characters with upper and lower case letters and a number.
          </p>
        </div>

        {hasError ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Passwords must match and meet the required strength rules.
          </div>
        ) : null}

        <form action={changePassword} className="space-y-5">
          <label className="field-label">
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            className="field-input mt-1"
            />
          </label>

          <label className="field-label">
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            className="field-input mt-1"
            />
          </label>

          <button
            type="submit"
            className="button-primary w-full"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
