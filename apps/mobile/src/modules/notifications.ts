import { supabase } from "../lib/supabase";

type DbRow = Record<string, unknown>;

export type NotificationFilter = "all" | "unread";

export interface MobileNotification {
  id: string;
  actorApplicationUserId: string | null;
  kind: string;
  title: string;
  body: string;
  targetPath: string;
  sourceType: string;
  sourceEntityId: string;
  sourceActivityId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

function nullableString(value: unknown) {
  return value == null ? null : String(value);
}

function mapNotification(row: DbRow): MobileNotification {
  return {
    id: String(row.id),
    actorApplicationUserId: nullableString(row.actor_application_user_id),
    kind: String(row.kind),
    title: String(row.title),
    body: String(row.body),
    targetPath: String(row.target_path),
    sourceType: String(row.source_type),
    sourceEntityId: String(row.source_entity_id),
    sourceActivityId: nullableString(row.source_activity_id),
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    readAt: nullableString(row.read_at),
    createdAt: String(row.created_at),
  };
}

export function notificationListQueryKey(
  accountId: string | undefined,
  filter: NotificationFilter,
) {
  return ["notifications", accountId, filter] as const;
}

export function notificationUnreadCountQueryKey(
  accountId: string | undefined,
) {
  return ["notifications", accountId, "unread-count"] as const;
}

export function notificationInvalidationKeys(
  accountId: string | undefined,
) {
  return [
    notificationListQueryKey(accountId, "all"),
    notificationListQueryKey(accountId, "unread"),
    notificationUnreadCountQueryKey(accountId),
  ] as const;
}

export async function listMyNotifications(
  filter: NotificationFilter = "all",
) {
  const { data, error } = await supabase.rpc("list_my_notifications", {
    p_limit: 50,
    p_offset: 0,
    p_unread_only: filter === "unread",
  });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map(mapNotification);
}

export async function getMyUnreadNotificationCount() {
  const { data, error } = await supabase.rpc(
    "get_my_unread_notification_count",
  );

  if (error) throw new Error(error.message);

  const count = Number(data ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export async function markMyNotificationRead(notificationId: string) {
  const { data, error } = await supabase.rpc(
    "mark_my_notification_read",
    {
      p_notification_id: notificationId,
    },
  );

  if (error) throw new Error(error.message);
  return String(data);
}

export async function markAllMyNotificationsRead() {
  const { data, error } = await supabase.rpc(
    "mark_all_my_notifications_read",
  );

  if (error) throw new Error(error.message);

  const count = Number(data ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

const localOrigin = "https://masjid-e-mamoor.invalid";

export function safeNotificationTarget(
  targetPath: string | null | undefined,
) {
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

    if (target.origin !== localOrigin) {
      return "/notifications";
    }

    return target.pathname + target.search + target.hash;
  } catch {
    return "/notifications";
  }
}

export function formatUnreadBadge(count: number) {
  if (!Number.isFinite(count) || count < 1) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
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
