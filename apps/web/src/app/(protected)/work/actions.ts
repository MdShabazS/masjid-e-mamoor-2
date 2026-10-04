"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addCommitteeTaskProgress,
  completeCommitteeTask,
  createCommitteeTask,
  getCommitteeTaskCapabilities,
  startCommitteeTask,
  updateCommitteeTask,
} from "@/lib/work/server";
import {
  committeeTaskCompletionSchema,
  committeeTaskDraftSchema,
  committeeTaskIdSchema,
  committeeTaskProgressSchema,
} from "@/lib/work/validation";

function taskDraftFrom(formData: FormData) {
  return committeeTaskDraftSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    assigneeIds: formData.getAll("assigneeIds").map(String),
  });
}

function refreshTaskPaths(taskId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/work");
  if (taskId) revalidatePath(`/work/${taskId}`);
}

export async function createCommitteeTaskAction(formData: FormData) {
  const capabilities = await getCommitteeTaskCapabilities();
  if (!capabilities.canAssign) redirect("/work?error=not_authorized");

  const parsed = taskDraftFrom(formData);
  if (!parsed.success) redirect("/work/new?error=invalid_task");

  let taskId: string;
  try {
    const task = await createCommitteeTask(parsed.data, randomUUID());
    taskId = task.id;
  } catch {
    redirect("/work/new?error=create_failed");
  }

  refreshTaskPaths(taskId);
  redirect(`/work/${taskId}?created=1`);
}

export async function updateCommitteeTaskAction(formData: FormData) {
  const capabilities = await getCommitteeTaskCapabilities();
  if (!capabilities.canAssign) redirect("/work?error=not_authorized");

  const taskId = committeeTaskIdSchema.safeParse(
    String(formData.get("taskId") ?? ""),
  );
  const draft = taskDraftFrom(formData);
  if (!taskId.success || !draft.success) {
    redirect("/work?error=invalid_task");
  }

  try {
    await updateCommitteeTask(taskId.data, draft.data, randomUUID());
  } catch {
    redirect(`/work/${taskId.data}/edit?error=update_failed`);
  }

  refreshTaskPaths(taskId.data);
  redirect(`/work/${taskId.data}?updated=1`);
}

export async function addCommitteeTaskProgressAction(formData: FormData) {
  const capabilities = await getCommitteeTaskCapabilities();
  if (!capabilities.canManage) redirect("/work?error=not_authorized");

  const taskId = committeeTaskIdSchema.safeParse(
    String(formData.get("taskId") ?? ""),
  );
  const remark = committeeTaskProgressSchema.safeParse(
    String(formData.get("remark") ?? ""),
  );
  if (!taskId.success || !remark.success) {
    redirect("/work?error=invalid_progress");
  }

  try {
    await addCommitteeTaskProgress(taskId.data, remark.data, randomUUID());
  } catch {
    redirect(`/work/${taskId.data}?error=progress_failed`);
  }

  refreshTaskPaths(taskId.data);
  redirect(`/work/${taskId.data}?progress=1`);
}

export async function startCommitteeTaskAction(formData: FormData) {
  const capabilities = await getCommitteeTaskCapabilities();
  if (!capabilities.canManage) redirect("/work?error=not_authorized");

  const taskId = committeeTaskIdSchema.safeParse(
    String(formData.get("taskId") ?? ""),
  );
  if (!taskId.success) redirect("/work?error=invalid_task");

  try {
    await startCommitteeTask(taskId.data, randomUUID());
  } catch {
    redirect(`/work/${taskId.data}?error=start_failed`);
  }

  refreshTaskPaths(taskId.data);
  redirect(`/work/${taskId.data}?started=1`);
}

export async function completeCommitteeTaskAction(formData: FormData) {
  const capabilities = await getCommitteeTaskCapabilities();
  if (!capabilities.canManage) redirect("/work?error=not_authorized");

  const taskId = committeeTaskIdSchema.safeParse(
    String(formData.get("taskId") ?? ""),
  );
  const notes = committeeTaskCompletionSchema.safeParse(
    String(formData.get("completionNotes") ?? ""),
  );
  if (!taskId.success || !notes.success) {
    redirect("/work?error=invalid_completion");
  }

  try {
    await completeCommitteeTask(taskId.data, notes.data, randomUUID());
  } catch {
    redirect(`/work/${taskId.data}?error=complete_failed`);
  }

  refreshTaskPaths(taskId.data);
  redirect(`/work/${taskId.data}?completed=1`);
}
