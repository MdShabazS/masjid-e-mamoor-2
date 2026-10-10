import {
  committeeTaskDetailQueryKey,
  committeeTaskListQueryKey,
  createCommitteeTask,
  updateCommitteeTask,
  addCommitteeTaskProgress,
  startCommitteeTask,
  completeCommitteeTask,
  type CommitteeTaskDetail,
} from "./work";
import {
  groupWorkTasks,
  isValidOpenTaskDraft,
  isValidTaskDraft,
  shouldShowAssigneeRole,
  taskActionVisibility,
  taskErrorMessage,
  taskSourceContext,
  workListState,
} from "./work-presentation";
import { supabase } from "../lib/supabase";

jest.mock("../lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;
const taskRow = {
  id: "task-1",
  title: "Prepare hall",
  description: null,
  priority: "normal",
  status: "assigned",
  due_date: null,
  created_by_application_user_id: "admin-1",
  completed_by_application_user_id: null,
  completed_at: null,
  created_at: "2026-10-02T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
  assignee_ids: ["committee-1"],
};

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: taskRow, error: null });
});

describe("committee Work presentation", () => {
  const detail = {
    ...taskRow,
    dueDate: null,
    createdAt: taskRow.created_at,
    updatedAt: taskRow.updated_at,
    createdByApplicationUserId: "admin-1",
    completedByApplicationUserId: null,
    completedAt: null,
    assignmentMode: "direct",
    isOverdue: false,
    sourceMeetingId: null,
    sourceMeetingDecisionId: null,
    assigneeIds: ["committee-1"],
    assignees: [
      {
        id: "a-1",
        applicationUserId: "committee-1",
        displayName: "Committee One",
        roleLabel: "Committee Member",
        assignedAt: taskRow.created_at,
        removedAt: null,
      },
    ],
    activity: [],
  } as CommitteeTaskDetail;

  it("represents loading, error, empty, and ready list states", () => {
    expect(workListState({ loading: true, error: false, count: 0 })).toBe("loading");
    expect(workListState({ loading: false, error: true, count: 0 })).toBe("error");
    expect(workListState({ loading: false, error: false, count: 0 })).toBe("empty");
    expect(workListState({ loading: false, error: false, count: 1 })).toBe("ready");
  });

  it("shows only state-valid assigned-user actions", () => {
    const capabilities = { canManageCommitteeTasks: true, canAssignCommitteeTasks: false };
    expect(
      taskActionVisibility({ accountId: "committee-1", capabilities, task: detail }),
    ).toMatchObject({ canAddProgress: true, canStart: true, canComplete: false, canEdit: false });
    expect(
      taskActionVisibility({
        accountId: "committee-1",
        capabilities,
        task: { ...detail, status: "in_progress" },
      }),
    ).toMatchObject({ canStart: false, canComplete: true });
    expect(
      taskActionVisibility({
        accountId: "committee-1",
        capabilities,
        task: { ...detail, status: "completed" },
      }),
    ).toMatchObject({ canAddProgress: false, canStart: false, canComplete: false });
  });

  it("allows an eligible non-assigner to claim only an open volunteer task", () => {
    const openTask = {
      ...detail,
      assignmentMode: "open" as const,
      status: "open" as const,
      assigneeIds: [],
      assignees: [],
    };

    expect(
      taskActionVisibility({
        accountId: "committee-1",
        capabilities: {
          canManageCommitteeTasks: true,
          canAssignCommitteeTasks: false,
        },
        task: openTask,
      }).canClaim,
    ).toBe(true);
    expect(
      taskActionVisibility({
        accountId: "manager-1",
        capabilities: {
          canManageCommitteeTasks: true,
          canAssignCommitteeTasks: true,
        },
        task: openTask,
      }).canClaim,
    ).toBe(false);
  });

  it("gives assign-capable users create/edit access without granting it to Committee Members", () => {
    expect(
      taskActionVisibility({
        accountId: "admin-1",
        capabilities: { canManageCommitteeTasks: true, canAssignCommitteeTasks: true },
        task: detail,
      }).canEdit,
    ).toBe(true);
    expect(
      taskActionVisibility({
        accountId: "committee-1",
        capabilities: { canManageCommitteeTasks: true, canAssignCommitteeTasks: false },
        task: detail,
      }).canEdit,
    ).toBe(false);
  });

  it("validates required task fields and surfaces backend errors", () => {
    expect(isValidTaskDraft({ title: "Task", dueDate: "2026-10-31", assigneeIds: ["a"] })).toBe(
      true,
    );
    expect(isValidTaskDraft({ title: "Task", dueDate: "", assigneeIds: [] })).toBe(false);
    expect(taskErrorMessage(new Error("missing_permission"))).toContain("not available");
    expect(isValidOpenTaskDraft({ title: "Volunteer", dueDate: "" })).toBe(true);
    expect(taskErrorMessage(new Error("task_already_claimed"))).toContain("already been claimed");
  });

  it("groups authorized tasks for Committee Member and Finance-style scopes", () => {
    const assigned = { ...detail, id: "assigned" };
    const open = {
      ...detail,
      id: "open",
      assignmentMode: "open" as const,
      status: "open" as const,
      assigneeIds: [],
    };
    const team = {
      ...detail,
      id: "team",
      assigneeIds: ["other-user"],
    };
    const completed = {
      ...detail,
      id: "completed",
      status: "completed" as const,
    };

    const committeeGroups = groupWorkTasks([assigned, open, team, completed], "committee-1");
    expect(committeeGroups.assigned.map((task) => task.id)).toEqual(["assigned"]);
    expect(committeeGroups.open.map((task) => task.id)).toEqual(["open"]);
    expect(committeeGroups.team.map((task) => task.id)).toEqual(["team"]);
    expect(committeeGroups.completed.map((task) => task.id)).toEqual(["completed"]);

    const financeScoped = groupWorkTasks([assigned, completed], "committee-1");
    expect(financeScoped.open).toEqual([]);
    expect(financeScoped.team).toEqual([]);
  });

  it("describes meeting-linked follow-up context without exposing identifiers", () => {
    expect(
      taskSourceContext({
        sourceMeetingId: "meeting-id",
        sourceMeetingDecisionId: "decision-id",
      }),
    ).toBe("Follow-up from a committee meeting decision");
    expect(taskSourceContext({ sourceMeetingId: null, sourceMeetingDecisionId: null })).toBeNull();
  });

  it("shows a role subtitle only when it adds information", () => {
    expect(shouldShowAssigneeRole("Amina Rahman", "Secretary")).toBe(true);
    expect(shouldShowAssigneeRole("Committee Member", "Committee Member")).toBe(false);
  });
});

describe("committee Work trusted mutations", () => {
  const draft = {
    title: "Prepare hall",
    description: "Before Jummah",
    priority: "high" as const,
    dueDate: "2026-10-09",
    assigneeIds: ["committee-1"],
  };

  it("calls create and edit trusted RPCs with stable supplied operation IDs", async () => {
    await createCommitteeTask(draft, "op-create");
    expect(rpc).toHaveBeenCalledWith(
      "create_committee_task",
      expect.objectContaining({ p_operation_id: "op-create", p_assignee_ids: ["committee-1"] }),
    );
    await updateCommitteeTask("task-1", draft, "op-update");
    expect(rpc).toHaveBeenCalledWith(
      "update_committee_task",
      expect.objectContaining({ p_task_id: "task-1", p_operation_id: "op-update" }),
    );
  });

  it("calls progress, start, and complete trusted RPCs", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: "activity-1",
        task_id: "task-1",
        actor_application_user_id: "committee-1",
        activity_type: "progress_added",
        remark: "Started setup",
        details: {},
        created_at: taskRow.created_at,
      },
      error: null,
    });
    await addCommitteeTaskProgress("task-1", "Started setup", "op-progress");
    await startCommitteeTask("task-1", "op-start");
    await completeCommitteeTask("task-1", "Done", "op-complete");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "add_committee_task_progress",
      "start_committee_task",
      "complete_committee_task",
    ]);
  });

  it("uses scoped query keys for invalidation", () => {
    expect(committeeTaskListQueryKey("actor-1")).toEqual(["committee-tasks", "actor-1"]);
    expect(committeeTaskDetailQueryKey("task-1")).toEqual(["committee-tasks", "detail", "task-1"]);
  });

  it("surfaces backend failures", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "not_assigned" } });
    await expect(startCommitteeTask("task-1", "op")).rejects.toThrow("not_assigned");
  });
});
