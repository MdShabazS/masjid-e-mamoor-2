import { supabase } from "../lib/supabase";
import {
  committeeMeetingAttendanceQueryKey,
  committeeMeetingDecisionsQueryKey,
  createCommitteeMeetingDecision,
  getCommitteeMeetingAttendance,
  listCommitteeMeetingDecisions,
} from "./meetings";
import {
  createCommitteeMeetingFollowupTask,
  createOpenCommitteeMeetingFollowupTask,
} from "./work";

jest.mock("../lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const rpc = supabase.rpc as jest.Mock;

const attendanceRow = {
  id: "attendance-1",
  meeting_id: "meeting-1",
  application_user_id: "committee-1",
  attendance_status: "present",
  recorded_by_application_user_id:
    "secretary-1",
  recorded_at: "2026-10-20T13:30:00.000Z",
  operation_id: "attendance-op",
};

const decisionRow = {
  id: "decision-1",
  meeting_id: "meeting-1",
  decision_text: "Arrange maintenance.",
  created_by_application_user_id:
    "committee-1",
  operation_id: "decision-op",
  request_fingerprint: "ignored-by-mobile",
  created_at: "2026-10-20T13:45:00.000Z",
};

const directFollowupRow = {
  id: "task-direct-1",
  title: "Arrange maintenance",
  description: "Meeting follow-up",
  priority: "high",
  status: "assigned",
  assignment_mode: "direct",
  due_date: "2026-10-25",
  is_overdue: false,
  source_meeting_id: "meeting-1",
  source_meeting_decision_id: "decision-1",
  created_by_application_user_id: "president-1",
  completed_by_application_user_id: null,
  completed_at: null,
  created_at: "2026-10-20T14:00:00.000Z",
  updated_at: "2026-10-20T14:00:00.000Z",
  assignee_ids: ["committee-1"],
};

const openFollowupRow = {
  ...directFollowupRow,
  id: "task-open-1",
  title: "Volunteer follow-up",
  status: "open",
  assignment_mode: "open",
  source_meeting_decision_id: null,
  assignee_ids: [],
};

beforeEach(() => {
  rpc.mockReset();
});

describe("Phase 11 meeting mobile domain parity", () => {
  it("uses stable meeting attendance and decision query keys", () => {
    expect(
      committeeMeetingAttendanceQueryKey(
        "meeting-1",
      ),
    ).toEqual([
      "committee-meetings",
      "attendance",
      "meeting-1",
    ]);

    expect(
      committeeMeetingDecisionsQueryKey(
        "meeting-1",
      ),
    ).toEqual([
      "committee-meetings",
      "decisions",
      "meeting-1",
    ]);
  });

  it("retrieves attendance through the explicit trusted RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: [attendanceRow],
      error: null,
    });

    const attendance =
      await getCommitteeMeetingAttendance(
        "meeting-1",
      );

    expect(rpc).toHaveBeenCalledWith(
      "get_committee_meeting_attendance",
      {
        p_meeting_id: "meeting-1",
      },
    );

    expect(attendance).toEqual([
      {
        id: "attendance-1",
        meetingId: "meeting-1",
        applicationUserId: "committee-1",
        attendanceStatus: "present",
        recordedByApplicationUserId:
          "secretary-1",
        recordedAt:
          "2026-10-20T13:30:00.000Z",
        operationId: "attendance-op",
      },
    ]);
  });

  it("lists append-only meeting decisions", async () => {
    rpc.mockResolvedValueOnce({
      data: [decisionRow],
      error: null,
    });

    const decisions =
      await listCommitteeMeetingDecisions(
        "meeting-1",
      );

    expect(rpc).toHaveBeenCalledWith(
      "list_committee_meeting_decisions",
      {
        p_meeting_id: "meeting-1",
      },
    );

    expect(decisions).toEqual([
      {
        id: "decision-1",
        meetingId: "meeting-1",
        decisionText: "Arrange maintenance.",
        createdByApplicationUserId:
          "committee-1",
        operationId: "decision-op",
        createdAt:
          "2026-10-20T13:45:00.000Z",
      },
    ]);
  });

  it("creates a meeting decision using a stable operation ID", async () => {
    rpc.mockResolvedValueOnce({
      data: decisionRow,
      error: null,
    });

    const decision =
      await createCommitteeMeetingDecision(
        "meeting-1",
        "  Arrange maintenance.  ",
        "decision-op",
      );

    expect(rpc).toHaveBeenCalledWith(
      "create_committee_meeting_decision",
      {
        p_meeting_id: "meeting-1",
        p_decision_text:
          "Arrange maintenance.",
        p_operation_id: "decision-op",
      },
    );

    expect(decision.id).toBe("decision-1");
  });

  it("creates a direct meeting follow-up through the trusted wrapper", async () => {
    rpc.mockResolvedValueOnce({
      data: directFollowupRow,
      error: null,
    });

    const task =
      await createCommitteeMeetingFollowupTask(
        "meeting-1",
        "decision-1",
        {
          title: "  Arrange maintenance  ",
          description:
            "  Meeting follow-up  ",
          priority: "high",
          dueDate: "2026-10-25",
          assigneeIds: ["committee-1"],
        },
        "followup-direct-op",
      );

    expect(rpc).toHaveBeenCalledWith(
      "create_committee_meeting_followup_task",
      {
        p_meeting_id: "meeting-1",
        p_decision_id: "decision-1",
        p_title: "Arrange maintenance",
        p_description: "Meeting follow-up",
        p_priority: "high",
        p_due_date: "2026-10-25",
        p_assignee_ids: ["committee-1"],
        p_operation_id:
          "followup-direct-op",
      },
    );

    expect(task).toMatchObject({
      assignmentMode: "direct",
      sourceMeetingId: "meeting-1",
      sourceMeetingDecisionId:
        "decision-1",
    });
  });

  it("creates an open meeting follow-up without a decision link", async () => {
    rpc.mockResolvedValueOnce({
      data: openFollowupRow,
      error: null,
    });

    const task =
      await createOpenCommitteeMeetingFollowupTask(
        "meeting-1",
        null,
        {
          title: " Volunteer follow-up ",
          description: " ",
          priority: "normal",
          dueDate: "",
        },
        "followup-open-op",
      );

    expect(rpc).toHaveBeenCalledWith(
      "create_open_committee_meeting_followup_task",
      {
        p_meeting_id: "meeting-1",
        p_decision_id: null,
        p_title: "Volunteer follow-up",
        p_description: null,
        p_priority: "normal",
        p_due_date: null,
        p_operation_id:
          "followup-open-op",
      },
    );

    expect(task).toMatchObject({
      status: "open",
      assignmentMode: "open",
      sourceMeetingId: "meeting-1",
      sourceMeetingDecisionId: null,
    });
  });

  it("surfaces Phase 11 backend authorization failures unchanged", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "meeting_not_found",
      },
    });

    await expect(
      listCommitteeMeetingDecisions(
        "meeting-hidden",
      ),
    ).rejects.toThrow(
      "meeting_not_found",
    );

    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: "missing_permission",
      },
    });

    await expect(
      createCommitteeMeetingDecision(
        "meeting-1",
        "Forbidden decision",
        "decision-forbidden",
      ),
    ).rejects.toThrow(
      "missing_permission",
    );

    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message:
          "meeting_decision_not_found",
      },
    });

    await expect(
      createCommitteeMeetingFollowupTask(
        "meeting-1",
        "wrong-decision",
        {
          title: "Follow-up",
          description: "",
          priority: "normal",
          dueDate: "",
          assigneeIds: [
            "committee-1",
          ],
        },
        "bad-link",
      ),
    ).rejects.toThrow(
      "meeting_decision_not_found",
    );
  });
});
