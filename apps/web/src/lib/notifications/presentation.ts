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
    }[kind] ?? "Notification"
  );
}
