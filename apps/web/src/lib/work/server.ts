import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

export type CommitteeTaskPriority = "low" | "normal" | "high";
export type CommitteeTaskStatus = "assigned" | "in_progress" | "completed";

export interface CommitteeTaskSummary {
  id: string;
  title: string;
  description: string | null;
  priority: CommitteeTaskPriority;
  status: CommitteeTaskStatus;
  dueDate: string | null;
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
  activityType: string;
  remark: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CommitteeTaskDetail extends CommitteeTaskSummary {
  assignees: CommitteeTaskAssignee[];
  activity: CommitteeTaskActivity[];
}

export interface CommitteeTaskListItem extends CommitteeTaskSummary {
  assignees: CommitteeTaskAssignee[];
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
  dueDate: string | null;
  assigneeIds: string[];
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
    dueDate: nullableString(row.due_date),
    createdByApplicationUserId: String(row.created_by_application_user_id),
    completedByApplicationUserId: nullableString(
      row.completed_by_application_user_id,
    ),
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
    activityType: String(row.activity_type),
    remark: nullableString(row.remark),
    details:
      row.details && typeof row.details === "object"
        ? (row.details as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
  };
}

function unwrapTask(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("task_not_found");
  }
  return mapTask(row as DbRow);
}

export const getCommitteeTaskCapabilities = cache(
  async function getCommitteeTaskCapabilities() {
    const supabase = await createClient();
    const [read, manage, assign] = await Promise.all([
      supabase.rpc("has_application_permission", {
        requested_permission: "committee.tasks.read",
      }),
      supabase.rpc("has_application_permission", {
        requested_permission: "committee.tasks.manage",
      }),
      supabase.rpc("has_application_permission", {
        requested_permission: "committee.tasks.assign",
      }),
    ]);

    if (read.error || manage.error || assign.error) {
      throw new Error("Unable to resolve committee task permissions.");
    }

    return {
      canRead: read.data === true,
      canManage: manage.data === true,
      canAssign: assign.data === true,
    };
  },
);

export async function listCommitteeTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_committee_tasks", {
    p_limit: 100,
    p_offset: 0,
  });

  if (error) throw error;
  return ((data ?? []) as DbRow[]).map(mapTask);
}

export async function getCommitteeTask(taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_committee_task", {
    p_task_id: taskId,
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(error?.message ?? "task_not_found");
  }

  const payload = data as {
    task?: unknown;
    assignees?: unknown;
    activity?: unknown;
  };

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

export async function listCommitteeTaskItems() {
  const tasks = await listCommitteeTasks();
  return Promise.all(
    tasks.map(async (task) => {
      try {
        const detail = await getCommitteeTask(task.id);
        return { ...task, assignees: detail.assignees };
      } catch {
        return { ...task, assignees: [] };
      }
    }),
  ) satisfies Promise<CommitteeTaskListItem[]>;
}

export async function listCommitteeTaskAssigneeOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_committee_task_assignee_options",
  );

  if (error) throw error;
  return ((data ?? []) as DbRow[]).map((row) => ({
    applicationUserId: String(row.application_user_id),
    displayName: String(row.display_name),
    roleLabel: String(row.role_label),
  })) satisfies CommitteeAssigneeOption[];
}

export async function createCommitteeTask(
  draft: CommitteeTaskDraft,
  operationId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_committee_task", {
    p_title: draft.title,
    p_description: draft.description || null,
    p_priority: draft.priority,
    p_due_date: draft.dueDate,
    p_assignee_ids: draft.assigneeIds,
    p_operation_id: operationId,
  });

  if (error) throw error;
  return unwrapTask(data);
}

export async function updateCommitteeTask(
  taskId: string,
  draft: CommitteeTaskDraft,
  operationId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_committee_task", {
    p_task_id: taskId,
    p_title: draft.title,
    p_description: draft.description || null,
    p_priority: draft.priority,
    p_due_date: draft.dueDate,
    p_assignee_ids: draft.assigneeIds,
    p_operation_id: operationId,
  });

  if (error) throw error;
  return unwrapTask(data);
}

export async function addCommitteeTaskProgress(
  taskId: string,
  remark: string,
  operationId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_committee_task_progress", {
    p_task_id: taskId,
    p_remark: remark,
    p_operation_id: operationId,
  });
  if (error) throw error;
}

export async function startCommitteeTask(
  taskId: string,
  operationId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_committee_task", {
    p_task_id: taskId,
    p_operation_id: operationId,
  });
  if (error) throw error;
}

export async function completeCommitteeTask(
  taskId: string,
  completionNotes: string,
  operationId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_committee_task", {
    p_task_id: taskId,
    p_completion_notes: completionNotes || null,
    p_operation_id: operationId,
  });
  if (error) throw error;
}
