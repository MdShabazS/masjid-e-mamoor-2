"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, type ProfilePasswordActionState } from "./actions";

const initialState: ProfilePasswordActionState = {};

export function ChangeOwnPasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPasswordAction, initialState);

  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="field-label">New password<input name="password" type="password" autoComplete="new-password" minLength={10} required className="field-input" /></label>
      <label className="field-label">Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required className="field-input" /></label>
      <button type="submit" disabled={pending} className="button-primary w-fit disabled:opacity-60">{pending ? "Updating…" : "Update password"}</button>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-emerald-800">{state.message}</p> : null}
    </form>
  );
}
