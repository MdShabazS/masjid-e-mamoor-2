import { randomUUID } from "expo-crypto";
import { supabase } from "../lib/supabase";

type DbRow = Record<string, unknown>;

export type CommitteeTaskPriority = "low" | "normal" | "high";
export type CommitteeTaskStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "completed";
export type CommitteeTaskAssignmentMode = "direct" | "open";

export interface CommitteeTaskSummary {
  id: string;
  title: string;
  description: string | null;
  priority: CommitteeTaskPriority;
  status: CommitteeTaskStatus;
  assignmentMode: CommitteeTaskAssignmentMode;
  dueDate: string | null;
  isOverdue: boolean;
  sourceMeetingId: string | null;
  sourceMeetingDecisionId: string | null;
  createdByApplicationUserId: string;
  completedByApplicationUserId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeIds: string[];
}

export interface CommitteeTaskAssignee {
  id: string;
  applicationUserId: string;
  displayName: string;
  roleLabel: string;
  assignedAt: string;
  removedAt: string | null;
}

export interface CommitteeTaskActivity {
  id: string;
  actorApplicationUserId: string;
  activityType: string;
  remark: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CommitteeTaskDetail extends CommitteeTaskSummary {
  assignees: CommitteeTaskAssignee[];
  activity: CommitteeTaskActivity[];
}

export interface CommitteeAssigneeOption {
  applicationUserId: string;
  displayName: string;
  roleLabel: string;
}

export interface CommitteeTaskDraft {
  title: string;
  description: string;
  priority: CommitteeTaskPriority;
  dueDate: string;
  assigneeIds: string[];
}

export interface CommitteeOpenTaskDraft {
  title: string;
  description: string;
  priority: CommitteeTaskPriority;
  dueDate: string;
}

export function createCommitteeOperationId() {
  return randomUUID();
}

export function committeeTaskListQueryKey(accountId: string | undefined) {
  return ["committee-tasks", accountId] as const;
}

export function committeeTaskDetailQueryKey(taskId: string) {
  return ["committee-tasks", "detail", taskId] as const;
}

export function committeeAssigneeOptionsQueryKey() {
  return ["committee-tasks", "assignee-options"] as const;
}

export function committeeTaskInvalidationKeys(
  accountId: string | undefined,
  taskId?: string,
) {
  return [
    committeeTaskListQueryKey(accountId),
    ...(taskId ? [committeeTaskDetailQueryKey(taskId)] : []),
  ];
}

function nullableString(value: unknown) {
  return value == null ? null : String(value);
}

function mapTask(row: DbRow): CommitteeTaskSummary {
  return {
    id: String(row.id),
    title: String(row.title),
    description: nullableString(row.description),
    priority: row.priority as CommitteeTaskPriority,
    status: row.status as CommitteeTaskStatus,
    assignmentMode:
      (row.assignment_mode ?? "direct") as CommitteeTaskAssignmentMode,
    dueDate: nullableString(row.due_date),
    isOverdue: row.is_overdue === true,
    sourceMeetingId: nullableString(row.source_meeting_id),
    sourceMeetingDecisionId: nullableString(
      row.source_meeting_decision_id,
    ),
    createdByApplicationUserId: String(
      row.created_by_application_user_id,
    ),
    completedByApplicationUserId: nullableString(row.completed_by_application_user_id),
    completedAt: nullableString(row.completed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    assigneeIds: Array.isArray(row.assignee_ids)
      ? row.assignee_ids.map(String)
      : [],
  };
}

function mapAssignee(row: DbRow): CommitteeTaskAssignee {
  return {
    id: String(row.id),
    applicationUserId: String(row.application_user_id),
    displayName: String(row.display_name),
    roleLabel: String(row.role_label),
    assignedAt: String(row.assigned_at),
    removedAt: nullableString(row.removed_at),
  };
}

function mapActivity(row: DbRow): CommitteeTaskActivity {
  return {
    id: String(row.id),
    actorApplicationUserId: String(row.actor_application_user_id),
    activityType: String(row.activity_type),
    remark: nullableString(row.remark),
    details:
      row.details && typeof row.details === "object"
        ? (row.details as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
  };
}

export async function listCommitteeTasks() {
  const { data, error } = await supabase.rpc("list_committee_tasks", {
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map(mapTask);
}

export async function getCommitteeTask(taskId: string) {
  const { data, error } = await supabase.rpc("get_committee_task", {
    p_task_id: taskId,
  });
  if (error || !data || typeof data !== "object") {
    throw new Error(error?.message ?? "task_not_found");
  }
  const payload = data as { task?: unknown; assignees?: unknown; activity?: unknown };
  if (!payload.task || typeof payload.task !== "object") {
    throw new Error("task_not_found");
  }
  return {
    ...mapTask(payload.task as DbRow),
    assignees: Array.isArray(payload.assignees)
      ? payload.assignees.map((row) => mapAssignee(row as DbRow))
      : [],
    activity: Array.isArray(payload.activity)
      ? payload.activity.map((row) => mapActivity(row as DbRow))
      : [],
  } satisfies CommitteeTaskDetail;
}

export async function listCommitteeAssigneeOptions() {
  const { data, error } = await supabase.rpc(
    "list_committee_task_assignee_options",
  );
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbRow[]).map((row) => ({
    applicationUserId: String(row.application_user_id),
    displayName: String(row.display_name),
    roleLabel: String(row.role_label),
  }));
}

export async function createCommitteeTask(
  draft: CommitteeTaskDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc("create_committee_task", {
    p_title: draft.title.trim(),
    p_description: draft.description.trim() || null,
    p_priority: draft.priority,
    p_due_date: draft.dueDate.trim() || null,
    p_assignee_ids: draft.assigneeIds,
    p_operation_id: operationId,
  });
  if (error || !data) throw new Error(error?.message ?? "task_create_failed");
  return mapTask(data as DbRow);
}

export async function createOpenCommitteeTask(
  draft: CommitteeOpenTaskDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "create_open_committee_task",
    {
      p_title: draft.title.trim(),
      p_description: draft.description.trim() || null,
      p_priority: draft.priority,
      p_due_date: draft.dueDate.trim() || null,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ?? "open_task_create_failed",
    );
  }

  return mapTask(data as DbRow);
}

export async function claimOpenCommitteeTask(
  taskId: string,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "claim_open_committee_task",
    {
      p_task_id: taskId,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ?? "open_task_claim_failed",
    );
  }

  return mapTask(data as DbRow);
}

export async function createCommitteeMeetingFollowupTask(
  meetingId: string,
  decisionId: string | null,
  draft: CommitteeTaskDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "create_committee_meeting_followup_task",
    {
      p_meeting_id: meetingId,
      p_decision_id: decisionId,
      p_title: draft.title.trim(),
      p_description:
        draft.description.trim() || null,
      p_priority: draft.priority,
      p_due_date:
        draft.dueDate.trim() || null,
      p_assignee_ids: draft.assigneeIds,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "meeting_followup_task_create_failed",
    );
  }

  return mapTask(data as DbRow);
}

export async function createOpenCommitteeMeetingFollowupTask(
  meetingId: string,
  decisionId: string | null,
  draft: CommitteeOpenTaskDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc(
    "create_open_committee_meeting_followup_task",
    {
      p_meeting_id: meetingId,
      p_decision_id: decisionId,
      p_title: draft.title.trim(),
      p_description:
        draft.description.trim() || null,
      p_priority: draft.priority,
      p_due_date:
        draft.dueDate.trim() || null,
      p_operation_id: operationId,
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ??
        "open_meeting_followup_task_create_failed",
    );
  }

  return mapTask(data as DbRow);
}

export async function updateCommitteeTask(
  taskId: string,
  draft: CommitteeTaskDraft,
  operationId: string,
) {
  const { data, error } = await supabase.rpc("update_committee_task", {
    p_task_id: taskId,
    p_title: draft.title.trim(),
    p_description: draft.description.trim() || null,
    p_priority: draft.priority,
    p_due_date: draft.dueDate.trim() || null,
    p_assignee_ids: draft.assigneeIds,
    p_operation_id: operationId,
  });
  if (error || !data) throw new Error(error?.message ?? "task_update_failed");
  return mapTask(data as DbRow);
}

export async function addCommitteeTaskProgress(
  taskId: string,
  remark: string,
  operationId: string,
) {
  const { data, error } = await supabase.rpc("add_committee_task_progress", {
    p_task_id: taskId,
    p_remark: remark.trim(),
    p_operation_id: operationId,
  });
  if (error || !data) throw new Error(error?.message ?? "task_progress_failed");
  return mapActivity(data as DbRow);
}

export async function startCommitteeTask(taskId: string, operationId: string) {
  const { data, error } = await supabase.rpc("start_committee_task", {
    p_task_id: taskId,
    p_operation_id: operationId,
  });
  if (error || !data) throw new Error(error?.message ?? "task_start_failed");
  return mapTask(data as DbRow);
}

export async function completeCommitteeTask(
  taskId: string,
  completionNotes: string,
  operationId: string,
) {
  const { data, error } = await supabase.rpc("complete_committee_task", {
    p_task_id: taskId,
    p_completion_notes: completionNotes.trim() || null,
    p_operation_id: operationId,
  });
  if (error || !data) throw new Error(error?.message ?? "task_complete_failed");
  return mapTask(data as DbRow);
}
