"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  generateFinanceMonthlyReport,
} from "@/lib/finance/server";
import {
  normalizeFinanceReportMonthInput,
} from "@/lib/finance/monthly";

export async function generateFinanceMonthlyReportAction(
  formData: FormData,
) {
  const reportMonth =
    normalizeFinanceReportMonthInput(
      String(formData.get("reportMonth") ?? ""),
    );

  if (!reportMonth) {
    redirect(
      "/finance/monthly-reports?error=invalid_month",
    );
  }

  const result =
    await generateFinanceMonthlyReport(reportMonth);

  if (result.status === "unauthenticated") {
    redirect("/login");
  }

  if (result.status === "forbidden") {
    redirect(
      "/finance/monthly-reports?error=not_authorized",
    );
  }

  if (result.status === "busy") {
    revalidatePath("/finance/monthly-reports");
    redirect(
      "/finance/monthly-reports?busy=1",
    );
  }

  if (result.status !== "ready") {
    redirect(
      "/finance/monthly-reports?error=generation_failed",
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/finance/monthly-reports");

  redirect(
    "/finance/monthly-reports?generated=1",
  );
}
