import { announcementListQueryKey } from "./announcements";
import { committeeMeetingDetailQueryKey, committeeMeetingListQueryKey } from "./meetings";
import { notificationInvalidationKeys } from "./notifications";
import { committeeTaskDetailQueryKey, committeeTaskListQueryKey } from "./work";

export interface RealtimeInvalidationEvent {
  kind?: string;
  sourceEntityId?: string;
  sourceType?: string;
}

export function realtimeInvalidationKeys(
  accountId: string,
  event: RealtimeInvalidationEvent,
) {
  const keys: readonly (readonly unknown[])[] = [...notificationInvalidationKeys(accountId)];

  if (event.sourceType === "committee_task") {
    return [
      ...keys,
      committeeTaskListQueryKey(accountId),
      ...(event.sourceEntityId ? [committeeTaskDetailQueryKey(event.sourceEntityId)] : []),
    ];
  }

  if (event.sourceType === "committee_meeting") {
    return [
      ...keys,
      committeeMeetingListQueryKey(accountId),
      ...(event.sourceEntityId ? [committeeMeetingDetailQueryKey(event.sourceEntityId)] : []),
    ];
  }

  if (event.sourceType === "announcement") {
    return [...keys, announcementListQueryKey(accountId)];
  }

  return keys;
}

export function foregroundInvalidationKeys(accountId: string) {
  return [
    ...notificationInvalidationKeys(accountId),
    announcementListQueryKey(accountId),
    committeeTaskListQueryKey(accountId),
    committeeMeetingListQueryKey(accountId),
    ["donations", accountId],
    ["finance"],
    ["members"],
    ["referrals"],
  ] as readonly (readonly unknown[])[];
}

export function parseRealtimeNotification(payload: unknown): RealtimeInvalidationEvent {
  if (!payload || typeof payload !== "object") return {};

  const envelope = payload as Record<string, unknown>;
  const candidate =
    envelope.payload && typeof envelope.payload === "object"
      ? (envelope.payload as Record<string, unknown>)
      : envelope;

  return {
    kind: typeof candidate.kind === "string" ? candidate.kind : undefined,
    sourceEntityId:
      typeof candidate.source_entity_id === "string"
        ? candidate.source_entity_id
        : undefined,
    sourceType:
      typeof candidate.source_type === "string" ? candidate.source_type : undefined,
  };
}
