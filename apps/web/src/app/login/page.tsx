import { signInWithUsernamePassword } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid_credentials";

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
      <section className="auth-card w-full max-w-md p-8 sm:p-10">
        <div className="mb-8">
          <p className="eyebrow">
            Masjid-e-Mamoor
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-emerald-950">Sign in to Masjid-e-Mamoor</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Use the username and password issued by an administrator.
          </p>
        </div>

        {hasError ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Username or password is incorrect.
          </div>
        ) : null}

        <form action={signInWithUsernamePassword} className="space-y-5">
            <label className="field-label">
            Username
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              className="field-input mt-1"
            />
          </label>

            <label className="field-label">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="field-input mt-1"
            />
          </label>

          <button
            type="submit"
            className="button-primary w-full"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
