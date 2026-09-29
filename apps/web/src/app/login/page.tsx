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
    <main className="auth-shell auth-layout min-h-screen">
      <section className="auth-brand-panel"><span className="brand-mark" aria-hidden="true"><span /></span><p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100">Masjid E Mamoor 2</p><h1 className="mt-3 text-3xl font-semibold text-white">Management System</h1><p className="mt-5 max-w-sm text-sm leading-6 text-emerald-100">Serving the Masjid with clarity, trust and accountability.</p></section>
      <section className="auth-form-panel flex items-center justify-center px-5 py-10 sm:px-8">
      <div className="auth-card w-full max-w-md p-8 sm:p-10">
        <div className="mb-8">
          <p className="eyebrow">Masjid E Mamoor 2</p>
          <h1 className="mt-2 text-3xl font-semibold text-emerald-950">Sign in to Masjid E Mamoor 2</h1>
          <p className="mt-2 text-sm font-medium text-emerald-800">Management System</p>
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
      </div>
      </section>
    </main>
  );
}
