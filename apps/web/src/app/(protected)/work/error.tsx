"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function WorkError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Work module failed to load", error);
  }, [error]);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="surface p-8 text-center">
          <h1 className="text-xl font-semibold text-emerald-950">
            Work could not be loaded
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Check your connection and try again. No task changes were made.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="button-primary">
              Try again
            </button>
            <Link href="/dashboard" className="button-secondary">
              Return to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
