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
    <section className="surface p-6 sm:p-8">
      <p className="eyebrow">Provisioning</p>
      <h2 className="section-title">Create account</h2>
      <p className="mt-2 text-sm text-zinc-600">Create an account only when the person is ready to receive access.</p>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="field-label">
          Username
          <input
            name="username"
            required
            className="field-input"
          />
        </label>

          <label className="field-label">
          Role
          <select
            name="role"
            required
            className="field-input"
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

        <label className="field-label">
          Display name
          <input
            name="displayName"
            className="field-input"
          />
        </label>

        <label className="field-label">
          Temporary password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            className="field-input"
          />
        </label>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="button-primary disabled:opacity-60"
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
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input name="accountId" type="hidden" value={accountId} />
      <label className="field-label min-w-64">
        New temporary password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          className="field-input"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="button-secondary disabled:opacity-60"
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
    <section className="surface p-6">
      <h2 className="section-title">Username security</h2>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="field-label">
          Username
          <input
            name="username"
            defaultValue={username ?? ""}
            required
            className="field-input"
          />
        </label>

        <label className="field-label">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="field-input"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="button-secondary disabled:opacity-60"
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
