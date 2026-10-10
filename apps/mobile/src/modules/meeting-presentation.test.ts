import type { CommitteeMeetingDetail, CommitteeMeetingSummary } from "./meetings";
import {
  groupCommitteeMeetings,
  isValidMeetingDraft,
  meetingActionVisibility,
  meetingAttendanceRows,
  meetingTypeLabel,
} from "./meeting-presentation";

describe("committee meeting presentation", () => {
  it("groups upcoming, past, and cancelled meetings deterministically", () => {
    const groups = groupCommitteeMeetings(
      [
        meeting({ id: "later", scheduledStart: "2026-10-20T10:00:00Z" }),
        meeting({ id: "past", scheduledStart: "2026-10-01T10:00:00Z" }),
        meeting({
          id: "cancelled",
          status: "cancelled",
          scheduledStart: "2026-10-12T10:00:00Z",
        }),
        meeting({ id: "next", scheduledStart: "2026-10-12T10:00:00Z" }),
      ],
      new Date("2026-10-10T00:00:00Z"),
    );

    expect(groups.upcoming.map((item) => item.id)).toEqual(["next", "later"]);
    expect(groups.past.map((item) => item.id)).toEqual(["past"]);
    expect(groups.cancelled.map((item) => item.id)).toEqual(["cancelled"]);
  });

  it("combines participants with present, absent, and unrecorded attendance", () => {
    const rows = meetingAttendanceRows(
      detail({
        attendance: [attendance("committee-1", "present"), attendance("committee-2", "absent")],
      }),
    );

    expect(rows.map((row) => row.attendance?.attendanceStatus ?? null)).toEqual([
      "present",
      "absent",
      null,
    ]);
  });

  it("keeps admin, participant, attendance, and task assignment actions independent", () => {
    const current = detail();
    expect(
      meetingActionVisibility({
        canAdminister: false,
        canAssignTasks: false,
        canRecordAttendance: true,
        canWriteParticipantDecision: true,
        meeting: current,
      }),
    ).toEqual({
      canEdit: false,
      canCancel: false,
      canRecordAttendance: true,
      canCreateDecision: true,
      canCreateFollowup: false,
    });

    expect(
      meetingActionVisibility({
        canAdminister: true,
        canAssignTasks: true,
        canRecordAttendance: true,
        canWriteParticipantDecision: false,
        meeting: detail({ status: "cancelled" }),
      }),
    ).toEqual({
      canEdit: false,
      canCancel: false,
      canRecordAttendance: false,
      canCreateDecision: false,
      canCreateFollowup: true,
    });
  });

  it("validates schedule order and required participants without inventing fields", () => {
    const valid = {
      title: "Monthly meeting",
      meetingType: "general",
      details: "",
      location: "",
      scheduledStart: "2026-10-20T13:00:00+05:30",
      scheduledEnd: "2026-10-20T14:00:00+05:30",
      participantIds: ["committee-1"],
    };

    expect(isValidMeetingDraft(valid)).toBe(true);
    expect(isValidMeetingDraft({ ...valid, participantIds: [] })).toBe(false);
    expect(
      isValidMeetingDraft({
        ...valid,
        scheduledEnd: "2026-10-20T12:00:00+05:30",
      }),
    ).toBe(false);
    expect(meetingTypeLabel("finance_review")).toBe("Finance Review");
  });
});

function meeting(overrides: Partial<CommitteeMeetingSummary> = {}): CommitteeMeetingSummary {
  return {
    id: "meeting-1",
    title: "Committee meeting",
    meetingType: "general",
    details: null,
    location: "Hall",
    scheduledStart: "2026-10-20T13:00:00Z",
    scheduledEnd: null,
    status: "scheduled",
    createdByApplicationUserId: "manager-1",
    cancelledByApplicationUserId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    participantIds: ["committee-1", "committee-2", "committee-3"],
    ...overrides,
  };
}

function detail(overrides: Partial<CommitteeMeetingDetail> = {}): CommitteeMeetingDetail {
  return {
    ...meeting(),
    participants: [
      participant("committee-1", "Committee One"),
      participant("committee-2", "Committee Two"),
      participant("committee-3", "Committee Three"),
    ],
    attendance: [],
    activity: [],
    ...overrides,
  };
}

function participant(applicationUserId: string, displayName: string) {
  return {
    applicationUserId,
    displayName,
    roleLabel: "Committee Member",
    assignedAt: "2026-10-01T10:00:00Z",
  };
}

function attendance(applicationUserId: string, attendanceStatus: "present" | "absent") {
  return {
    id: `attendance-${applicationUserId}`,
    meetingId: "meeting-1",
    applicationUserId,
    attendanceStatus,
    recordedByApplicationUserId: "secretary-1",
    recordedAt: "2026-10-20T13:30:00Z",
    operationId: `operation-${applicationUserId}`,
  };
}
