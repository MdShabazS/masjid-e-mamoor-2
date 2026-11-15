import * as Crypto from "expo-crypto";
import * as Location from "expo-location";

import { supabase } from "../lib/supabase";
import {
  cacheJummahEvents,
  enqueueJummahAttendance,
  getCachedJummahEvents,
  getQueuedJummahAttendance,
  markJummahAttendanceApplied,
  markJummahAttendanceAttempt,
  markJummahAttendanceRejected,
  type AttendanceSource,
  type CachedJummahEvent,
  type LocalJummahAttendance,
} from "./jummah-attendance-store";

const PAGE_SIZE = 50;

export type JummahAttendanceEvent = CachedJummahEvent;

export interface JummahAttendanceEventDraft {
  scheduledFor: Date;
  checkinOpensAt: Date;
  checkinClosesAt: Date;
  centerLatitude: number;
  centerLongitude: number;
}

export interface AttendanceListPage {
  events: JummahAttendanceEvent[];
  source: "server" | "cache";
}

interface DbEventRow {
  event_id: unknown;
  scheduled_for: unknown;
  checkin_opens_at: unknown;
  checkin_closes_at: unknown;
  is_open: unknown;
  my_attendance_recorded_at: unknown;
}

interface DbAttendanceResult {
  attendance_record_id: unknown;
  event_id: unknown;
  recorded_at: unknown;
  already_recorded: unknown;
  outcome: unknown;
  error_code: unknown;
}

const permanentAttendanceErrors = new Set([
  "active_member_profile_required",
  "attendance_event_not_found",
  "attendance_window_closed",
  "invalid_attendance_location",
  "invalid_attendance_source",
  "invalid_operation_id",
  "not_authorized",
  "operation_id_conflict",
  "outside_attendance_radius",
]);

function stringOrNull(value: unknown) {
  return value == null ? null : String(value);
}

export function mapJummahAttendanceEvent(row: DbEventRow): JummahAttendanceEvent {
  return {
    eventId: String(row.event_id),
    scheduledFor: String(row.scheduled_for),
    checkinOpensAt: String(row.checkin_opens_at),
    checkinClosesAt: String(row.checkin_closes_at),
    isOpen: row.is_open === true,
    myAttendanceRecordedAt: stringOrNull(row.my_attendance_recorded_at),
  };
}

export function validateJummahAttendanceEventDraft(
  draft: JummahAttendanceEventDraft,
) {
  const values = [
    draft.scheduledFor,
    draft.checkinOpensAt,
    draft.checkinClosesAt,
  ];
  if (values.some((value) => !(value instanceof Date) || !Number.isFinite(value.getTime()))) {
    return "invalid_event_time" as const;
  }
  if (draft.checkinClosesAt <= draft.checkinOpensAt) {
    return "invalid_event_window" as const;
  }
  if (
    !Number.isFinite(draft.centerLatitude) ||
    draft.centerLatitude < -90 || draft.centerLatitude > 90 ||
    !Number.isFinite(draft.centerLongitude) ||
    draft.centerLongitude < -180 || draft.centerLongitude > 180
  ) {
    return "invalid_event_location" as const;
  }
  return null;
}

export function jummahAttendanceEventDraftIdentity(draft: JummahAttendanceEventDraft) {
  return JSON.stringify([
    draft.scheduledFor.getTime(),
    draft.checkinOpensAt.getTime(),
    draft.checkinClosesAt.getTime(),
    draft.centerLatitude,
    draft.centerLongitude,
  ]);
}

export function createJummahAttendanceOperationId() {
  return Crypto.randomUUID();
}

export function jummahAttendanceQueryKey(applicationUserId: string | undefined) {
  return ["jummah-attendance", applicationUserId ?? "anonymous"] as const;
}

export function latestLocalAttendanceByEvent(
  records: LocalJummahAttendance[],
) {
  const latest = new Map<string, LocalJummahAttendance>();
  for (const record of records) {
    const current = latest.get(record.eventId);
    if (!current || Date.parse(record.createdAt) > Date.parse(current.createdAt)) {
      latest.set(record.eventId, record);
    }
  }
  return latest;
}

export async function listJummahAttendanceEvents(
  applicationUserId: string,
  before?: { scheduledFor: string; eventId: string },
): Promise<AttendanceListPage> {
  const { data, error } = await supabase.rpc("list_jummah_attendance_events", {
    p_before_scheduled_for: before?.scheduledFor ?? null,
    p_before_event_id: before?.eventId ?? null,
    p_limit: PAGE_SIZE,
  });

  if (error) {
    const events = await getCachedJummahEvents(applicationUserId, before);
    if (events.length > 0) return { events, source: "cache" };
    throw error;
  }

  const events = ((data ?? []) as DbEventRow[]).map(mapJummahAttendanceEvent);
  await cacheJummahEvents(applicationUserId, events);
  return { events, source: "server" };
}

export function nextJummahAttendanceCursor(page: AttendanceListPage) {
  if (page.events.length < PAGE_SIZE) return undefined;
  const last = page.events.at(-1);
  return last
    ? { scheduledFor: last.scheduledFor, eventId: last.eventId }
    : undefined;
}

export async function createJummahAttendanceEvent(
  draft: JummahAttendanceEventDraft,
  operationId: string,
) {
  const validationError = validateJummahAttendanceEventDraft(draft);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase.rpc("create_jummah_attendance_event", {
    p_scheduled_for: draft.scheduledFor.toISOString(),
    p_checkin_opens_at: draft.checkinOpensAt.toISOString(),
    p_checkin_closes_at: draft.checkinClosesAt.toISOString(),
    p_center_latitude: draft.centerLatitude,
    p_center_longitude: draft.centerLongitude,
    p_operation_id: operationId,
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("event_id" in row)) {
    throw new Error("attendance_event_response_invalid");
  }
  return String(row.event_id);
}

function permanentErrorFromUnknown(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known = [...permanentAttendanceErrors].find((code) =>
    message === code || message.endsWith(`: ${code}`),
  );
  return known ?? null;
}

async function submitQueuedOperation(operation: Awaited<ReturnType<typeof getQueuedJummahAttendance>>[number]) {
  await markJummahAttendanceAttempt(operation.operationId);
  const { data, error } = await supabase.rpc("record_self_jummah_attendance", {
    p_expected_actor_application_user_id: operation.ownerApplicationUserId,
    p_event_id: operation.eventId,
    p_latitude: operation.latitude,
    p_longitude: operation.longitude,
    p_operation_id: operation.operationId,
    p_source: operation.source,
  });

  if (error) {
    const permanent = permanentErrorFromUnknown(new Error(error.message));
    if (permanent) await markJummahAttendanceRejected(operation.operationId, permanent);
    return { applied: false, rejected: Boolean(permanent), errorCode: permanent };
  }

  const result = (Array.isArray(data) ? data[0] : data) as DbAttendanceResult | null;
  if (result?.outcome === "rejected") {
    const errorCode = String(result.error_code ?? "attendance_rejected");
    await markJummahAttendanceRejected(operation.operationId, errorCode);
    return { applied: false, rejected: true, errorCode };
  }
  if (!result || result.attendance_record_id == null || result.recorded_at == null) {
    return { applied: false, rejected: false, errorCode: null };
  }

  await markJummahAttendanceApplied(
    operation.operationId,
    String(result.attendance_record_id),
    String(result.recorded_at),
  );
  return { applied: true, rejected: false, errorCode: null };
}

const syncingUsers = new Set<string>();

export async function syncQueuedJummahAttendance(applicationUserId: string) {
  if (syncingUsers.has(applicationUserId)) return { applied: 0, rejected: 0 };
  syncingUsers.add(applicationUserId);
  try {
    const queued = await getQueuedJummahAttendance(applicationUserId);
    let applied = 0;
    let rejected = 0;
    for (const operation of queued) {
      const result = await submitQueuedOperation(operation);
      if (result.applied) applied += 1;
      if (result.rejected) rejected += 1;
    }
    return { applied, rejected };
  } finally {
    syncingUsers.delete(applicationUserId);
  }
}

export async function recordSelfJummahAttendance(input: {
  applicationUserId: string;
  eventId: string;
  latitude: number;
  longitude: number;
  operationId: string;
  source: AttendanceSource;
}) {
  await enqueueJummahAttendance({
    operationId: input.operationId,
    ownerApplicationUserId: input.applicationUserId,
    eventId: input.eventId,
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source,
    attemptCount: 0,
  });

  if (input.source === "offline") return { status: "queued" as const };
  const result = await submitQueuedOperation({
    operationId: input.operationId,
    ownerApplicationUserId: input.applicationUserId,
    eventId: input.eventId,
    latitude: input.latitude,
    longitude: input.longitude,
    source: input.source,
    attemptCount: 0,
  });
  if (result.rejected) {
    throw new Error(result.errorCode ?? "attendance_rejected");
  }
  return { status: result.applied ? "applied" as const : "queued" as const };
}

export async function getCurrentJummahLocation() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (permission.status !== "granted") {
    throw new Error("location_permission_required");
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

export function jummahAttendanceSource(isConnected: boolean | null | undefined, isInternetReachable: boolean | null | undefined): AttendanceSource {
  return isConnected === true && isInternetReachable !== false ? "online" : "offline";
}
