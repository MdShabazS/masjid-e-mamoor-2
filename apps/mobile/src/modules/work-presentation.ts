import type { MobileCapabilities } from "./capabilities";
import type {
  CommitteeTaskDetail,
  CommitteeTaskPriority,
  CommitteeTaskSummary,
  CommitteeTaskStatus,
} from "./work";

export type WorkListState = "loading" | "error" | "empty" | "ready";

export function workListState(input: {
  loading: boolean;
  error: boolean;
  count: number;
}): WorkListState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  return input.count === 0 ? "empty" : "ready";
}

export function taskActionVisibility(input: {
  accountId: string;
  capabilities: Pick<MobileCapabilities, "canManageCommitteeTasks" | "canAssignCommitteeTasks">;
  task: CommitteeTaskDetail;
}) {
  const assigned = input.task.assignees.some(
    (assignee) => assignee.removedAt === null && assignee.applicationUserId === input.accountId,
  );
  const canMutate =
    input.capabilities.canManageCommitteeTasks &&
    (input.capabilities.canAssignCommitteeTasks || assigned);

  return {
    canClaim:
      input.capabilities.canManageCommitteeTasks &&
      !input.capabilities.canAssignCommitteeTasks &&
      input.task.assignmentMode === "open" &&
      input.task.status === "open",
    canAddProgress: canMutate && input.task.status !== "completed",
    canStart: canMutate && input.task.status === "assigned",
    canComplete: canMutate && input.task.status === "in_progress",
    canEdit:
      input.capabilities.canAssignCommitteeTasks &&
      input.task.status !== "open" &&
      input.task.status !== "completed",
  };
}

export interface WorkTaskGroups {
  assigned: CommitteeTaskSummary[];
  completed: CommitteeTaskSummary[];
  open: CommitteeTaskSummary[];
  team: CommitteeTaskSummary[];
}

export function groupWorkTasks(
  tasks: readonly CommitteeTaskSummary[],
  accountId: string,
): WorkTaskGroups {
  const activeSort = (left: CommitteeTaskSummary, right: CommitteeTaskSummary) => {
    if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
    if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
    if (left.dueDate) return -1;
    if (right.dueDate) return 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  };
  const completedSort = (left: CommitteeTaskSummary, right: CommitteeTaskSummary) =>
    right.updatedAt.localeCompare(left.updatedAt);

  return {
    assigned: tasks
      .filter((task) => task.status !== "completed" && task.assigneeIds.includes(accountId))
      .sort(activeSort),
    open: tasks
      .filter((task) => task.status === "open" && task.assignmentMode === "open")
      .sort(activeSort),
    team: tasks
      .filter(
        (task) =>
          task.status !== "completed" &&
          task.status !== "open" &&
          !task.assigneeIds.includes(accountId),
      )
      .sort(activeSort),
    completed: tasks.filter((task) => task.status === "completed").sort(completedSort),
  };
}

export function taskSourceContext(
  task: Pick<CommitteeTaskSummary, "sourceMeetingId" | "sourceMeetingDecisionId">,
) {
  if (task.sourceMeetingDecisionId) return "Follow-up from a committee meeting decision";
  if (task.sourceMeetingId) return "Follow-up from a committee meeting";
  return null;
}

export const taskPriorityLabels: Record<CommitteeTaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const taskStatusLabels: Record<CommitteeTaskStatus, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
};

export function shouldShowAssigneeRole(displayName: string, roleLabel: string) {
  return displayName.trim().toLocaleLowerCase() !== roleLabel.trim().toLocaleLowerCase();
}

export function formatTaskDate(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
}

export function isValidTaskDraft(input: {
  title: string;
  dueDate: string;
  assigneeIds: readonly string[];
}) {
  if (!input.title.trim() || input.title.trim().length > 200) return false;
  if (input.assigneeIds.length === 0) return false;
  if (!input.dueDate.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate.trim());
}

export function isValidOpenTaskDraft(input: { title: string; dueDate: string }) {
  if (!input.title.trim() || input.title.trim().length > 200) return false;
  if (!input.dueDate.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate.trim());
}

export function taskErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("task_already_claimed")) {
    return "This volunteer task has already been claimed. Refresh to see its current assignee.";
  }
  if (message.includes("invalid_") || message.includes("assignee_required")) {
    return "Check the task details and try again.";
  }
  if (message.includes("missing_permission") || message.includes("not_assigned")) {
    return "This task action is not available for your account.";
  }
  return "The task could not be updated. Check your connection and try again.";
}

export function shouldSubmitTaskMutation(input: { isPending: boolean; isValid: boolean }) {
  return !input.isPending && input.isValid;
}
