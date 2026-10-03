"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  financeAccountCreateSchema,
  financeAccountStatusChangeSchema,
} from "@masjid-e-mamoor/validation";

import {
  createFinanceAccount,
  setFinanceAccountStatus,
} from "@/lib/finance/server";

function refreshFinanceAccountPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/finance/accounts");
  revalidatePath("/donations/manage");
}

export async function createFinanceAccountAction(
  formData: FormData,
) {
  const parsed = financeAccountCreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    accountType: String(
      formData.get("accountType") ?? "",
    ),
    operationId: randomUUID(),
  });

  if (!parsed.success) {
    redirect(
      "/finance/accounts?error=invalid_account",
    );
  }

  try {
    await createFinanceAccount(parsed.data);
  } catch {
    redirect(
      "/finance/accounts?error=create_failed",
    );
  }

  refreshFinanceAccountPaths();

  redirect("/finance/accounts?created=1");
}

export async function setFinanceAccountStatusAction(
  formData: FormData,
) {
  const parsed =
    financeAccountStatusChangeSchema.safeParse({
      financeAccountId: String(
        formData.get("financeAccountId") ?? "",
      ),
      status: String(formData.get("status") ?? ""),
      operationId: randomUUID(),
    });

  if (!parsed.success) {
    redirect(
      "/finance/accounts?error=invalid_status",
    );
  }

  try {
    await setFinanceAccountStatus(parsed.data);
  } catch {
    redirect(
      "/finance/accounts?error=status_failed",
    );
  }

  refreshFinanceAccountPaths();

  redirect("/finance/accounts?updated=1");
}
