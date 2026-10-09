import type { MobileCapabilities } from "./capabilities";
import type {
  CommitteeTaskDetail,
  CommitteeTaskPriority,
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
  capabilities: Pick<
    MobileCapabilities,
    "canManageCommitteeTasks" | "canAssignCommitteeTasks"
  >;
  task: CommitteeTaskDetail;
}) {
  const assigned = input.task.assignees.some(
    (assignee) =>
      assignee.removedAt === null &&
      assignee.applicationUserId === input.accountId,
  );
  const canMutate =
    input.capabilities.canManageCommitteeTasks &&
    (input.capabilities.canAssignCommitteeTasks || assigned);

  return {
    canAddProgress: canMutate && input.task.status !== "completed",
    canStart: canMutate && input.task.status === "assigned",
    canComplete: canMutate && input.task.status === "in_progress",
    canEdit:
      input.capabilities.canAssignCommitteeTasks &&
      input.task.status !== "completed",
  };
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

export function shouldShowAssigneeRole(
  displayName: string,
  roleLabel: string,
) {
  return displayName.trim().toLocaleLowerCase() !==
    roleLabel.trim().toLocaleLowerCase();
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

export function taskErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("invalid_") || message.includes("assignee_required")) {
    return "Check the task details and try again.";
  }
  if (message.includes("missing_permission") || message.includes("not_assigned")) {
    return "This task action is not available for your account.";
  }
  return "The task could not be updated. Check your connection and try again.";
}

export function shouldSubmitTaskMutation(input: {
  isPending: boolean;
  isValid: boolean;
}) {
  return !input.isPending && input.isValid;
}
