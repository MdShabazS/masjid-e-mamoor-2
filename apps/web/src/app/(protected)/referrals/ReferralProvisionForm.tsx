"use client";

import { useActionState } from "react";

import {
  completeReferralProvisionAction,
  type ReferralActionState,
} from "./actions";

export function ReferralProvisionForm({
  referralId,
  operationId,
}: {
  referralId: string;
  operationId: string;
}) {
  const [state, action, pending] = useActionState<
    ReferralActionState,
    FormData
  >(completeReferralProvisionAction, {});

  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="referralId" value={referralId} />
      <input type="hidden" name="operationId" value={operationId} />
      <label className="grid gap-1 text-sm">
        Username
        <input
          name="username"
          required
          minLength={3}
          maxLength={40}
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Temporary password
        <input
          name="password"
          type="password"
          minLength={10}
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="Auto-generate if empty"
        />
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Provision account
        </button>
      </div>
      {state.error ? (
        <p className="sm:col-span-3 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state.message ? (
        <div className="sm:col-span-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>{state.message}</p>
          {state.temporaryPassword ? (
            <p className="mt-1 font-mono">{state.temporaryPassword}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
