import type {
  CommitteeMeetingAttendance,
  CommitteeMeetingDetail,
  CommitteeMeetingSummary,
} from "./meetings";

export interface MeetingGroups {
  upcoming: CommitteeMeetingSummary[];
  past: CommitteeMeetingSummary[];
  cancelled: CommitteeMeetingSummary[];
}

export function groupCommitteeMeetings(
  meetings: CommitteeMeetingSummary[],
  now = new Date(),
): MeetingGroups {
  const nowTime = now.getTime();
  const upcoming: CommitteeMeetingSummary[] = [];
  const past: CommitteeMeetingSummary[] = [];
  const cancelled: CommitteeMeetingSummary[] = [];

  for (const meeting of meetings) {
    if (meeting.status === "cancelled") {
      cancelled.push(meeting);
      continue;
    }

    const endTime = new Date(meeting.scheduledEnd ?? meeting.scheduledStart).getTime();
    (endTime >= nowTime ? upcoming : past).push(meeting);
  }

  upcoming.sort((left, right) => meetingTime(left) - meetingTime(right));
  past.sort((left, right) => meetingTime(right) - meetingTime(left));
  cancelled.sort((left, right) => meetingTime(right) - meetingTime(left));

  return { upcoming, past, cancelled };
}

export function meetingStatusLabel(meeting: CommitteeMeetingSummary, now = new Date()) {
  if (meeting.status === "cancelled") return "Cancelled";
  return new Date(meeting.scheduledEnd ?? meeting.scheduledStart).getTime() < now.getTime()
    ? "Past"
    : "Scheduled";
}

export function meetingTypeLabel(value: string) {
  const normalized = value.trim().replaceAll("_", " ");
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Meeting";
}

export function formatMeetingDateTime(value: string | null) {
  if (!value) return "Not specified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export function meetingAttendanceRows(meeting: CommitteeMeetingDetail) {
  const attendanceByParticipant = new Map<string, CommitteeMeetingAttendance>(
    meeting.attendance.map((entry) => [entry.applicationUserId, entry]),
  );

  return meeting.participants.map((participant) => ({
    participant,
    attendance: attendanceByParticipant.get(participant.applicationUserId) ?? null,
  }));
}

export function meetingActionVisibility({
  canAdminister,
  canAssignTasks,
  canRecordAttendance,
  canWriteParticipantDecision,
  meeting,
}: {
  canAdminister: boolean;
  canAssignTasks: boolean;
  canRecordAttendance: boolean;
  canWriteParticipantDecision: boolean;
  meeting: CommitteeMeetingDetail;
}) {
  const active = meeting.status === "scheduled";

  return {
    canEdit: canAdminister && active,
    canCancel: canAdminister && active,
    canRecordAttendance: canRecordAttendance && active,
    canCreateDecision: active && (canAdminister || canWriteParticipantDecision),
    canCreateFollowup: canAssignTasks,
  };
}

export function isValidMeetingDraft({
  scheduledEnd,
  scheduledStart,
  title,
  meetingType,
  participantIds,
}: {
  scheduledEnd: string;
  scheduledStart: string;
  title: string;
  meetingType: string;
  participantIds: string[];
}) {
  const start = Date.parse(scheduledStart);
  const end = scheduledEnd.trim() ? Date.parse(scheduledEnd) : null;

  return (
    title.trim().length > 0 &&
    meetingType.trim().length > 0 &&
    participantIds.length > 0 &&
    Number.isFinite(start) &&
    (end === null || (Number.isFinite(end) && end > start))
  );
}

function meetingTime(meeting: CommitteeMeetingSummary) {
  const value = new Date(meeting.scheduledStart).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}
