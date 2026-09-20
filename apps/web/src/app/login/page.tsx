import { signInWithOtp, verifyOtp } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    sent?: string;
    phone?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const phone = params.phone ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-zinc-500">Masjid-e-Mamoor</p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Use your registered phone number to continue.
          </p>
        </div>

        {params.error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        )}

        {!sent ? (
          <form action={signInWithOtp} className="space-y-5">
            <label className="block text-sm font-medium">
              Phone number
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="+919876543210"
                required
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-3 outline-none focus:border-zinc-900"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-800"
            >
              Send OTP
            </button>
          </form>
        ) : (
          <form action={verifyOtp} className="space-y-5">
            <input type="hidden" name="phone" value={phone} />

            <label className="block text-sm font-medium">
              OTP
              <input
                name="token"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-3 tracking-[0.4em] outline-none focus:border-zinc-900"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white hover:bg-zinc-800"
            >
              Verify OTP
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
