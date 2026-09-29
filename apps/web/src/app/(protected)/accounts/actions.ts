"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  accountCreateSchema,
  accountPasswordResetSchema,
  accountRoleChangeSchema,
  accountStatusChangeSchema,
  accountUsernameChangeSchema,
  ownUsernameChangeSchema,
} from "@masjid-e-mamoor/validation";
import {
  changeAccountRole,
  changeAccountStatus,
  changeAccountUsername,
  changeOwnUsername,
  createAccount,
  resetAccountPassword,
} from "@/lib/accounts/server";

export type AccountActionState = {
  error?: string;
  message?: string;
  temporaryPassword?: string;
};

const genericError = "The account action could not be completed.";

export async function createAccountAction(
  _state: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = accountCreateSchema.safeParse({
    username: formData.get("username"),
    role: formData.get("role"),
    displayName: formData.get("displayName") || undefined,
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    return { error: "Check the username, role, and password." };
  }

  try {
    const result = await createAccount(parsed.data);
    revalidatePath("/accounts");
    return {
      message: "Account created.",
      temporaryPassword: result.temporaryPassword,
    };
  } catch {
    return { error: genericError };
  }
}

export async function resetPasswordAction(
  _state: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = accountPasswordResetSchema.safeParse({
    accountId: formData.get("accountId"),
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    return { error: "Check the selected account and password." };
  }

  try {
    const temporaryPassword = await resetAccountPassword(
      parsed.data.accountId,
      parsed.data.password,
    );
    revalidatePath("/accounts");
    return {
      message: "Temporary password assigned.",
      temporaryPassword,
    };
  } catch {
    return { error: genericError };
  }
}

export async function changeOwnUsernameAction(
  _state: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = ownUsernameChangeSchema.safeParse({
    username: formData.get("username"),
    currentPassword: formData.get("currentPassword"),
  });

  if (!parsed.success) {
    return { error: "Check the username and current password." };
  }

  try {
    await changeOwnUsername(
      parsed.data.username,
      parsed.data.currentPassword,
    );
    revalidatePath("/accounts");
    return { message: "Username updated." };
  } catch {
    return { error: genericError };
  }
}

export async function changeUsernameAction(formData: FormData) {
  const parsed = accountUsernameChangeSchema.safeParse({
    accountId: formData.get("accountId"),
    username: formData.get("username"),
  });

  if (!parsed.success) redirect("/accounts?error=invalid_username");

  await changeAccountUsername(parsed.data.accountId, parsed.data.username);
  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function changeRoleAction(formData: FormData) {
  const parsed = accountRoleChangeSchema.safeParse({
    accountId: formData.get("accountId"),
    role: formData.get("role"),
  });

  if (!parsed.success) redirect("/accounts?error=invalid_role");

  await changeAccountRole(parsed.data.accountId, parsed.data.role);
  revalidatePath("/accounts");
  redirect("/accounts");
}

export async function changeStatusAction(formData: FormData) {
  const parsed = accountStatusChangeSchema.safeParse({
    accountId: formData.get("accountId"),
    status: formData.get("status"),
  });

  if (!parsed.success) redirect("/accounts?error=invalid_status");

  await changeAccountStatus(parsed.data.accountId, parsed.data.status);
  revalidatePath("/accounts");
  redirect("/accounts");
}
