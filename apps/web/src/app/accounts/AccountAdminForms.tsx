"use client";

import { useActionState } from "react";
import {
  changeOwnUsernameAction,
  createAccountAction,
  resetPasswordAction,
  type AccountActionState,
} from "./actions";

const initialState: AccountActionState = {};

export function CreateAccountForm({
  allowPresident,
}: {
  allowPresident: boolean;
}) {
  const [state, action, pending] = useActionState(
    createAccountAction,
    initialState,
  );

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6">
      <h2 className="text-lg font-semibold">Create account</h2>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">
          Username
          <input
            name="username"
            required
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="block text-sm font-medium">
          Role
          <select
            name="role"
            required
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
          >
            <option value="member">Member</option>
            <option value="committee_member">Committee Member</option>
            <option value="auditor">Auditor</option>
            <option value="finance">Finance</option>
            <option value="secretary">Secretary</option>
            <option value="vice_president">Vice President</option>
            {allowPresident ? (
              <option value="president">President</option>
            ) : null}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Display name
          <input
            name="displayName"
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="block text-sm font-medium">
          Temporary password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            Create account
          </button>
        </div>
      </form>

      <ActionResult state={state} />
    </section>
  );
}

export function ResetPasswordForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <input name="accountId" type="hidden" value={accountId} />
      <label className="text-sm font-medium">
        New temporary password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          className="mt-1 w-64 rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
      >
        Reset password
      </button>
      <ActionResult state={state} compact />
    </form>
  );
}

export function OwnUsernameForm({
  username,
}: {
  username: string | null;
}) {
  const [state, action, pending] = useActionState(
    changeOwnUsernameAction,
    initialState,
  );

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6">
      <h2 className="text-lg font-semibold">My username</h2>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="block text-sm font-medium">
          Username
          <input
            name="username"
            defaultValue={username ?? ""}
            required
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
          />
        </label>

        <label className="block text-sm font-medium">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            Save username
          </button>
        </div>
      </form>
      <ActionResult state={state} />
    </section>
  );
}

function ActionResult({
  state,
  compact = false,
}: {
  state: AccountActionState;
  compact?: boolean;
}) {
  if (!state.error && !state.message && !state.temporaryPassword) {
    return null;
  }

  return (
    <div
      className={
        compact
          ? "text-sm"
          : "mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
      }
    >
      {state.error ? (
        <p className="text-red-700">{state.error}</p>
      ) : (
        <p className="text-zinc-700">{state.message}</p>
      )}
      {state.temporaryPassword ? (
        <p className="mt-2 font-mono text-zinc-900">
          {state.temporaryPassword}
        </p>
      ) : null}
    </div>
  );
}
