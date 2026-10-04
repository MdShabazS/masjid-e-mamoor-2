import type { CommitteeTaskListItem } from "./server";

export type CommitteeTaskView = "all" | "mine";
export type CommitteeTaskStatusFilter =
  | "active"
  | "assigned"
  | "in_progress"
  | "completed"
  | "all";

export type CommitteeTaskCounts = {
  active: number;
  assigned: number;
  inProgress: number;
  completed: number;
};

const validViews = new Set<CommitteeTaskView>(["all", "mine"]);
const validStatuses = new Set<CommitteeTaskStatusFilter>([
  "active",
  "assigned",
  "in_progress",
  "completed",
  "all",
]);

export function resolveCommitteeTaskView(input: {
  requestedView?: string;
  canAssign: boolean;
}): CommitteeTaskView {
  if (!input.canAssign) return "mine";
  return input.requestedView &&
    validViews.has(input.requestedView as CommitteeTaskView)
    ? (input.requestedView as CommitteeTaskView)
    : "all";
}

export function resolveCommitteeTaskStatusFilter(
  requestedStatus?: string,
): CommitteeTaskStatusFilter {
  return requestedStatus &&
    validStatuses.has(requestedStatus as CommitteeTaskStatusFilter)
    ? (requestedStatus as CommitteeTaskStatusFilter)
    : "active";
}

export function isActiveAssignee(
  task: CommitteeTaskListItem,
  applicationUserId: string,
) {
  return task.assigneeIds.includes(applicationUserId);
}

export function isCommitteeTaskOverdue(
  task: CommitteeTaskListItem,
  today: string,
) {
  return (
    task.status !== "completed" &&
    task.dueDate !== null &&
    task.dueDate.slice(0, 10) < today
  );
}

export function getCommitteeTaskCounts(
  tasks: readonly CommitteeTaskListItem[],
): CommitteeTaskCounts {
  const assigned = tasks.filter((task) => task.status === "assigned").length;
  const inProgress = tasks.filter(
    (task) => task.status === "in_progress",
  ).length;
  return {
    active: assigned + inProgress,
    assigned,
    inProgress,
    completed: tasks.filter((task) => task.status === "completed").length,
  };
}

export function filterCommitteeTasksByStatus(
  tasks: readonly CommitteeTaskListItem[],
  status: CommitteeTaskStatusFilter,
) {
  if (status === "all") return [...tasks];
  if (status === "active") {
    return tasks.filter((task) => task.status !== "completed");
  }
  return tasks.filter((task) => task.status === status);
}

export function sortCommitteeTasks(
  tasks: readonly CommitteeTaskListItem[],
) {
  return [...tasks].sort((left, right) => {
    const leftCompleted = left.status === "completed" ? 1 : 0;
    const rightCompleted = right.status === "completed" ? 1 : 0;
    if (leftCompleted !== rightCompleted) {
      return leftCompleted - rightCompleted;
    }

    if (!leftCompleted) {
      const leftHasDueDate = left.dueDate !== null ? 0 : 1;
      const rightHasDueDate = right.dueDate !== null ? 0 : 1;
      if (leftHasDueDate !== rightHasDueDate) {
        return leftHasDueDate - rightHasDueDate;
      }
      if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
        return left.dueDate.localeCompare(right.dueDate);
      }
    }

    const updatedOrder = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedOrder !== 0) return updatedOrder;

    const createdOrder = right.createdAt.localeCompare(left.createdAt);
    if (createdOrder !== 0) return createdOrder;
    return left.id.localeCompare(right.id);
  });
}

export function buildCommitteeTaskWorkspace(input: {
  tasks: readonly CommitteeTaskListItem[];
  applicationUserId: string;
  canAssign: boolean;
  requestedView?: string;
  requestedStatus?: string;
}) {
  const view = resolveCommitteeTaskView({
    requestedView: input.requestedView,
    canAssign: input.canAssign,
  });
  const status = resolveCommitteeTaskStatusFilter(input.requestedStatus);
  const viewedTasks =
    view === "mine"
      ? input.tasks.filter((task) =>
          isActiveAssignee(task, input.applicationUserId),
        )
      : [...input.tasks];

  return {
    view,
    status,
    counts: getCommitteeTaskCounts(viewedTasks),
    tasks: sortCommitteeTasks(filterCommitteeTasksByStatus(viewedTasks, status)),
  };
}
