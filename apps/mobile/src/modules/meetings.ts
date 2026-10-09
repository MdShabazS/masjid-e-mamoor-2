import { randomUUID } from "expo-crypto";

import { supabase } from "../lib/supabase";

type DbRow = Record<string, unknown>;

export type CommitteeMeetingStatus =
  | "scheduled"
  | "cancelled";

export type CommitteeMeetingAttendanceStatus =
  | "present"
  | "absent";

export interface CommitteeMeetingSummary {
  id: string;
  title: string;
  meetingType: string;
  details: string | null;
  location: string | null;
  scheduledStart: string;
  scheduledEnd: string | null;
  status: CommitteeMeetingStatus;
  createdByApplicationUserId: string;
  cancelledByApplicationUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  participantIds: string[];
}

export interface CommitteeMeetingParticipant {
  applicationUserId: string;
  displayName: string;
  roleLabel: string;
  assignedAt: string;
}

export interface CommitteeMeetingAttendance {
  id: string;
  meetingId: string;
  applicationUserId: string;
  attendanceStatus: CommitteeMeetingAttendanceStatus;
  recordedByApplicationUserId: string;
  recordedAt: string;
  operationId: string;
}

export interface CommitteeMeetingDecision {
  id: string;
  meetingId: string;
  decisionText: string;
  createdByApplicationUserId: string;
  operationId: string;
  createdAt: string;
}

export interface CommitteeMeetingActivity {
  id: string;
  meetingId: string;
  actorApplicationUserId: string;
  activityType: string;
  details: Record<string, unknown>;
  operationId: string;
  createdAt: string;
}

export interface CommitteeMeetingDetail
  extends CommitteeMeetingSummary {
  participants: CommitteeMeetingParticipant[];
  attendance: CommitteeMeetingAttendance[];
  activity: CommitteeMeetingActivity[];
}

export interface CommitteeMeetingParticipantOption {
  applicationUserId: string;
  displayName: string;
  roleLabel: string;
}

export interface CommitteeMeetingDraft {
  title: string;
  meetingType: string;
  details: string;
  location: string;
  scheduledStart: string;
  scheduledEnd: string;
  participantIds: string[];
}

export function createCommitteeMeetingOperationId() {
  return randomUUID();
}

export function committeeMeetingListQueryKey(
  accountId: string | undefined,
) {
  return [
    "committee-meetings",
    accountId ?? "anonymous",
  ] as const;
}

export function committeeMeetingDetailQueryKey(
  meetingId: string,
) {
  return [
    "committee-meetings",
    "detail",
    meetingId,
  ] as const;
}

export function committeeMeetingAttendanceQueryKey(
  meetingId: string,
) {
  return [
    "committee-meetings",
    "attendance",
    meetingId,
  ] as const;
}

export function committeeMeetingDecisionsQueryKey(
  meetingId: string,
) {
  return [
    "committee-meetings",
    "decisions",
    meetingId,
  ] as const;
}

export function committeeMeetingParticipantOptionsQueryKey() {
  return [
    "committee-meetings",
    "participant-options",
  ] as const;
}

export function committeeMeetingInvalidationKeys(
  accountId: string | undefined,
  meetingId?: string,
) {
  return [
    committeeMeetingListQueryKey(accountId),
    ...(meetingId
      ? [committeeMeetingDetailQueryKey(meetingId)]
      : []),
  ];
}

function nullableString(value: unknown) {
  return value == null ? null : String(value);
}

function mapMeeting(
  row: DbRow,
): CommitteeMeetingSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    meetingType: String(row.meeting_type),
    details: nullableString(row.details),
    location: nullableString(row.location),
    scheduledStart: String(row.scheduled_start),
    scheduledEnd: nullableString(row.scheduled_end),
    status: row.status as CommitteeMeetingStatus,
    createdByApplicationUserId: String(
      row.created_by_application_user_id,
    ),
    cancelledByApplicationUserId: nullableString(
      row.cancelled_by_application_user_id,
    ),
    cancelledAt: nullableString(row.cancelled_at),
    cancellationReason: nullableString(
      row.cancellation_reason,
    ),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    participantIds: Array.isArray(row.participant_ids)
      ? row.participant_ids.map(String)
      : [],
  };
}

function mapParticipant(
  row: DbRow,
): CommitteeMeetingParticipant {
  return {
    applicationUserId: String(
      row.application_user_id,
    ),
    displayName: String(row.display_name),
    roleLabel: String(row.role_label),
    assignedAt: String(row.assigned_at),
  };
}

function mapAttendance(
  row: DbRow,
): CommitteeMeetingAttendance {
  return {
    id: String(row.id),
    meetingId: String(row.meeting_id),
    applicationUserId: String(
      row.application_user_id,
    ),
    attendanceStatus:
      row.attendance_status as CommitteeMeetingAttendanceStatus,
    recordedByApplicationUserId: String(
      row.recorded_by_application_user_id,
    ),
    recordedAt: String(row.recorded_at),
    operationId: String(row.operation_id),
  };
}

function mapDecision(
  row: DbRow,
): CommitteeMeetingDecision {
  return {
    id: String(row.id),
    meetingId: String(row.meeting_id),
    decisionText: String(row.decision_text),
    createdByApplicationUserId: String(
      row.created_by_application_user_id,
    ),
    operationId: String(row.operation_id),
    createdAt: String(row.created_at),
  };
}

function mapActivity(
  row: DbRow,
): CommitteeMeetingActivity {
  return {
    id: String(row.id),
    meetingId: String(row.meeting_id),
    actorApplicationUserId: String(
      row.actor_application_user_id,
    ),
    activityType: String(row.activity_type),
    details:
      row.details &&
      typeof row.details === "object"
        ? (row.details as Record<string, unknown>)
        : {},
    operationId: String(row.operation_id),
    createdAt: String(row.created_at),
  };
}

export async function listCommitteeMeetings() {
  const { data, error } = await supabase.rpc(
    "list_committee_meetings",
    {
      p_limit: 100,
      p_offset: 0,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbRow[]).map(
    mapMeeting,
  );
}

export async function getCommitteeMeeting(
  meetingId: string,
) {
  const { data, error } = await supabase.rpc(
    "get_committee_meeting",
    {
      p_meeting_id: meetingId,
    },
  );

  if (
    error ||
    !data ||
    typeof data !== "object"
  ) {
    throw new Error(
      error?.message ?? "meeting_not_found",
    );
  }

  const payload = data as {
    meeting?: unknown;
    participants?: unknown;
    attendance?: unknown;
    activity?: unknown;
  };

  if (
    !payload.meeting ||
    typeof payload.meeting !== "object"
  ) {
    throw new Error("meeting_not_found");
  }

  const participants = Array.isArray(
    payload.participants,
  )
    ? payload.participants.map((row) =>
        mapParticipant(row as DbRow),
      )
    : [];

  return {
    ...mapMeeting(payload.meeting as DbRow),
    participantIds: participants.map(
      (participant) =>
        participant.applicationUserId,
    ),
    participants,
    attendance: Array.isArray(
      payload.attendance,
    )
      ? payload.attendance.map((row) =>
          mapAttendance(row as DbRow),
        )
      : [],
    activity: Array.isArray(payload.activity)
      ? payload.activity.map((row) =>
          mapActivity(row as DbRow),
        )
      : [],
  } satisfies CommitteeMeetingDetail;
}

export async function getCommitteeMeetingAttendance(
  meetingId: string,
) {
  const { data, error } = await supabase.rpc(
    "get_committee_meeting_attendance",
    {
      p_meeting_id: meetingId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbRow[]).map(
    mapAttendance,
  );
}

export async function listCommitteeMeetingDecisions(
  meetingId: string,
) {
  const { data, error } = await supabase.rpc(
    "list_committee_meeting_decisions",
    {
      p_meeting_id: meetingId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbRow[]).map(
    mapDecision,
  );
}

export async function createCommitteeMeetingDecision(
  meetingId: string,
  decisionText: string,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "create_committee_meeting_decision",
    {
      p_meeting_id: meetingId,
      p_decision_text: decisionText.trim(),
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "meeting_decision_create_failed",
    );
  }

  return mapDecision(data as DbRow);
}

export async function listCommitteeMeetingParticipantOptions() {
  const { data, error } = await supabase.rpc(
    "list_committee_meeting_participant_options",
  );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbRow[]).map(
    (row) => ({
      applicationUserId: String(
        row.application_user_id,
      ),
      displayName: String(row.display_name),
      roleLabel: String(row.role_label),
    }),
  );
}

export async function createCommitteeMeeting(
  draft: CommitteeMeetingDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "create_committee_meeting",
    {
      p_title: draft.title.trim(),
      p_meeting_type:
        draft.meetingType.trim(),
      p_details:
        draft.details.trim() || null,
      p_location:
        draft.location.trim() || null,
      p_scheduled_start:
        draft.scheduledStart.trim(),
      p_scheduled_end:
        draft.scheduledEnd.trim() || null,
      p_participant_ids:
        draft.participantIds,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "meeting_create_failed",
    );
  }

  return mapMeeting(data as DbRow);
}

export async function updateCommitteeMeeting(
  meetingId: string,
  draft: CommitteeMeetingDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "update_committee_meeting",
    {
      p_meeting_id: meetingId,
      p_title: draft.title.trim(),
      p_meeting_type:
        draft.meetingType.trim(),
      p_details:
        draft.details.trim() || null,
      p_location:
        draft.location.trim() || null,
      p_scheduled_start:
        draft.scheduledStart.trim(),
      p_scheduled_end:
        draft.scheduledEnd.trim() || null,
      p_participant_ids:
        draft.participantIds,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "meeting_update_failed",
    );
  }

  return mapMeeting(data as DbRow);
}

export async function cancelCommitteeMeeting(
  meetingId: string,
  reason: string,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "cancel_committee_meeting",
    {
      p_meeting_id: meetingId,
      p_reason: reason.trim(),
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "meeting_cancel_failed",
    );
  }

  return mapMeeting(data as DbRow);
}

export async function recordCommitteeMeetingAttendance(
  meetingId: string,
  applicationUserId: string,
  attendanceStatus:
    CommitteeMeetingAttendanceStatus,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "record_committee_meeting_attendance",
    {
      p_meeting_id: meetingId,
      p_application_user_id:
        applicationUserId,
      p_attendance_status:
        attendanceStatus,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "meeting_attendance_failed",
    );
  }

  return mapAttendance(data as DbRow);
}
