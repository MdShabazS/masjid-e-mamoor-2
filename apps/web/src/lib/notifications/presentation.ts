export type NotificationFilter = "all" | "unread";

const localOrigin = "https://masjid-e-mamoor.invalid";

export function resolveNotificationFilter(
  requestedFilter: string | undefined,
): NotificationFilter {
  return requestedFilter === "unread" ? "unread" : "all";
}

export function safeNotificationTarget(targetPath: string | null | undefined) {
  if (
    !targetPath ||
    !targetPath.startsWith("/") ||
    targetPath.startsWith("//") ||
    targetPath.includes("\\")
  ) {
    return "/notifications";
  }

  try {
    const target = new URL(targetPath, localOrigin);
    if (target.origin !== localOrigin) return "/notifications";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/notifications";
  }
}

export function formatUnreadBadge(count: number) {
  if (count < 1) return null;
  return count > 99 ? "99+" : String(count);
}

export function notificationKindLabel(kind: string) {
  return (
    {
      task_assigned: "Task assigned",
      task_unassigned: "Task unassigned",
      task_updated: "Task updated",
      task_progress: "Task progress",
      task_started: "Task started",
      task_completed: "Task completed",
      expense_awaiting_approval: "Expense awaiting approval",
      expense_approved: "Expense approved",
      expense_rejected: "Expense not approved",
      transfer_awaiting_approval: "Transfer awaiting approval",
      transfer_approved: "Transfer approved",
      transfer_rejected: "Transfer not approved",
      adjustment_awaiting_approval: "Adjustment awaiting approval",
      correction_applied: "Correction approved",
      reversal_applied: "Reversal approved",
      adjustment_rejected: "Adjustment not approved",
      payment_submitted: "Payment awaiting review",
      payment_verified: "Payment verified",
      payment_rejected: "Payment not verified",
      referral_awaiting_review: "Referral needs review",
      referral_approved: "Referral approved",
      referral_rejected: "Referral not approved",
      referral_completed: "Referral registration completed",
    }[kind] ?? "Notification"
  );
}
