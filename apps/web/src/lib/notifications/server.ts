import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

export interface NotificationRecord {
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

function mapNotification(row: DbRow): NotificationRecord {
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
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    readAt: nullableString(row.read_at),
    createdAt: String(row.created_at),
  };
}

export async function listMyNotifications({
  unreadOnly = false,
  limit = 50,
  offset = 0,
}: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_notifications", {
    p_limit: Math.min(Math.max(limit, 1), 50),
    p_offset: Math.max(offset, 0),
    p_unread_only: unreadOnly,
  });

  if (error) throw error;
  return ((data ?? []) as DbRow[]).map(mapNotification);
}

export const getMyUnreadNotificationCount = cache(
  async function getMyUnreadNotificationCount() {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_my_unread_notification_count",
    );

    if (error) throw error;
    const count = Number(data ?? 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  },
);

export async function markMyNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_my_notification_read", {
    p_notification_id: notificationId,
  });

  if (error) throw error;
  return String(data);
}

export async function markAllMyNotificationsRead() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "mark_all_my_notifications_read",
  );

  if (error) throw error;
  return Number(data ?? 0);
}
