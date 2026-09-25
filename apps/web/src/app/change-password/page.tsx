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
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">
            Masjid-e-Mamoor
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Change password
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Set a new password before continuing.
          </p>
        </div>

        {hasError ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Passwords must match and meet the required strength rules.
          </div>
        ) : null}

        <form action={changePassword} className="space-y-5">
          <label className="block text-sm font-medium">
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-3 outline-none focus:border-zinc-900"
            />
          </label>

          <label className="block text-sm font-medium">
            Confirm password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-3 outline-none focus:border-zinc-900"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-800"
          >
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
