import { randomUUID } from "expo-crypto";

import { supabase } from "../lib/supabase";
import type { MobileNotification } from "./notifications";

type DbRow = Record<string, unknown>;

export interface AnnouncementDraft {
  body: string;
  title: string;
}

export function announcementListQueryKey(accountId: string | undefined) {
  return ["announcements", accountId ?? "anonymous"] as const;
}

function nullableString(value: unknown) {
  return value == null ? null : String(value);
}

function mapAnnouncement(row: DbRow): MobileNotification {
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
    sourceMeetingActivityId: null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    readAt: nullableString(row.read_at),
    createdAt: String(row.created_at),
  };
}

export async function listMyAnnouncements() {
  const { data, error } = await supabase.rpc("list_my_announcements", {
    p_limit: 50,
    p_offset: 0,
  });

  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map(mapAnnouncement);
}

export async function publishAnnouncement(draft: AnnouncementDraft) {
  const { data, error } = await supabase.rpc("publish_announcement", {
    p_title: draft.title.trim(),
    p_body: draft.body.trim(),
    p_target_path: "/announcements",
    p_operation_id: randomUUID(),
  });

  if (error || !data) {
    throw new Error(error?.message ?? "announcement_publish_failed");
  }

  return data as DbRow;
}
