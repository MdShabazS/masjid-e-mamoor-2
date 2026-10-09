import {
  claimOpenCommitteeTask,
  createOpenCommitteeTask,
  getCommitteeTask,
  listCommitteeTasks,
} from "./work";
import { supabase } from "../lib/supabase";

jest.mock("../lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;

const openTaskRow = {
  id: "open-task-1",
  title: "Volunteer hall setup",
  description: "Prepare the hall",
  priority: "high",
  status: "open",
  assignment_mode: "open",
  due_date: "2026-10-12",
  is_overdue: true,
  source_meeting_id: "meeting-1",
  source_meeting_decision_id: "decision-1",
  created_by_application_user_id: "president-1",
  completed_by_application_user_id: null,
  completed_at: null,
  created_at: "2026-10-09T00:00:00Z",
  updated_at: "2026-10-09T00:00:00Z",
  assignee_ids: [],
};

beforeEach(() => {
  rpc.mockReset();
});

describe("committee work Phase 10 domain parity", () => {
  it("maps open, overdue, assignment-mode and meeting linkage", async () => {
    rpc.mockResolvedValueOnce({
      data: [openTaskRow],
      error: null,
    });

    const tasks = await listCommitteeTasks();

    expect(rpc).toHaveBeenCalledWith(
      "list_committee_tasks",
      {
        p_limit: 100,
        p_offset: 0,
      },
    );

    expect(tasks).toEqual([
      expect.objectContaining({
        id: "open-task-1",
        status: "open",
        assignmentMode: "open",
        isOverdue: true,
        sourceMeetingId: "meeting-1",
        sourceMeetingDecisionId: "decision-1",
        assigneeIds: [],
      }),
    ]);
  });

  it("defaults legacy/direct rows safely", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          ...openTaskRow,
          id: "direct-task-1",
          status: "assigned",
          assignment_mode: undefined,
          is_overdue: undefined,
          source_meeting_id: undefined,
          source_meeting_decision_id: undefined,
        },
      ],
      error: null,
    });

    const [task] = await listCommitteeTasks();

    expect(task).toMatchObject({
      assignmentMode: "direct",
      isOverdue: false,
      sourceMeetingId: null,
      sourceMeetingDecisionId: null,
    });
  });

  it("maps follow-up linkage from task detail", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        task: {
          ...openTaskRow,
          status: "assigned",
          assignment_mode: "direct",
          is_overdue: false,
        },
        assignees: [],
        activity: [],
      },
      error: null,
    });

    const task = await getCommitteeTask("open-task-1");

    expect(rpc).toHaveBeenCalledWith(
      "get_committee_task",
      {
        p_task_id: "open-task-1",
      },
    );

    expect(task).toMatchObject({
      assignmentMode: "direct",
      sourceMeetingId: "meeting-1",
      sourceMeetingDecisionId: "decision-1",
    });
  });

  it("creates an open task using the authoritative RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: openTaskRow,
      error: null,
    });

    const task = await createOpenCommitteeTask(
      {
        title: "  Volunteer hall setup  ",
        description: "  Prepare the hall  ",
        priority: "high",
        dueDate: "2026-10-12",
      },
      "open-create-op",
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_open_committee_task",
      {
        p_title: "Volunteer hall setup",
        p_description: "Prepare the hall",
        p_priority: "high",
        p_due_date: "2026-10-12",
        p_operation_id: "open-create-op",
      },
    );

    expect(task.status).toBe("open");
    expect(task.assignmentMode).toBe("open");
  });

  it("claims an open task using the atomic claim RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ...openTaskRow,
        status: "assigned",
        assignee_ids: ["committee-1"],
      },
      error: null,
    });

    const task = await claimOpenCommitteeTask(
      "open-task-1",
      "claim-op",
    );

    expect(rpc).toHaveBeenCalledWith(
      "claim_open_committee_task",
      {
        p_task_id: "open-task-1",
        p_operation_id: "claim-op",
      },
    );

    expect(task.status).toBe("assigned");
    expect(task.assignmentMode).toBe("open");
  });

  it("surfaces open-task create and claim backend failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "missing_permission" },
    });

    await expect(
      createOpenCommitteeTask(
        {
          title: "Volunteer task",
          description: "",
          priority: "normal",
          dueDate: "",
        },
        "forbidden-create",
      ),
    ).rejects.toThrow("missing_permission");

    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "task_already_claimed" },
    });

    await expect(
      claimOpenCommitteeTask(
        "open-task-1",
        "claim-loser",
      ),
    ).rejects.toThrow("task_already_claimed");
  });
});
