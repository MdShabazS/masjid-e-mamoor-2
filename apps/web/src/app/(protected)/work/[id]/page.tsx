import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/accounts/server";
import {
  getCommitteeTask,
  getCommitteeTaskCapabilities,
  type CommitteeTaskActivity,
  type CommitteeTaskPriority,
  type CommitteeTaskStatus,
} from "@/lib/work/server";
import {
  addCommitteeTaskProgressAction,
  completeCommitteeTaskAction,
  startCommitteeTaskAction,
} from "../actions";
import { WorkSubmitButton } from "../WorkSubmitButton";

type TaskDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    created?: string;
    updated?: string;
    progress?: string;
    started?: string;
    completed?: string;
  }>;
};

export default async function TaskDetailPage({
  params,
  searchParams,
}: TaskDetailPageProps) {
  const [{ id }, query, capabilities, account] = await Promise.all([
    params,
    searchParams,
    getCommitteeTaskCapabilities(),
    getCurrentAccount(),
  ]);
  if (!capabilities.canRead || !account) redirect("/dashboard");

  const task = await getCommitteeTask(id);
  const activeAssignees = task.assignees.filter(
    (assignee) => assignee.removedAt === null,
  );
  const isAssigned = activeAssignees.some(
    (assignee) => assignee.applicationUserId === account.id,
  );
  const canAct =
    capabilities.canManage && (capabilities.canAssign || isAssigned);
  const canAddProgress = canAct && task.status !== "completed";
  const canStart = canAct && task.status === "assigned";
  const canComplete = canAct && task.status === "in_progress";

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-emerald-950/10 pb-8">
          <Link
            href="/work"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
          >
            ← Work
          </Link>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Committee task</p>
              <h1 className="page-title">{task.title}</h1>
            </div>
            {capabilities.canAssign && task.status !== "completed" ? (
              <Link href={`/work/${task.id}/edit`} className="button-secondary w-fit">
                Edit task
              </Link>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={statusClass(task.status)}>
              {statusLabel(task.status)}
            </span>
            <span className={priorityClass(task.priority)}>
              {priorityLabel(task.priority)}
            </span>
          </div>
        </header>

        {query.error ? (
          <Notice tone="error" copy={errorMessage(query.error)} />
        ) : null}
        {query.created ? <Notice copy="Task created." /> : null}
        {query.updated ? <Notice copy="Task updated." /> : null}
        {query.progress ? <Notice copy="Progress update added." /> : null}
        {query.started ? <Notice copy="Task started." /> : null}
        {query.completed ? <Notice copy="Task completed." /> : null}

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface p-6 sm:p-8">
            <p className="eyebrow">Overview</p>
            <h2 className="section-title">Task details</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
              {task.description || "No description provided."}
            </p>
            <dl className="mt-6 grid gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2">
              <Detail label="Due date" value={formatTaskDate(task.dueDate)} />
              <Detail label="Created" value={formatTimestamp(task.createdAt)} />
              <Detail label="Updated" value={formatTimestamp(task.updatedAt)} />
              {task.completedAt ? (
                <Detail
                  label="Completed"
                  value={formatTimestamp(task.completedAt)}
                />
              ) : null}
            </dl>
          </div>

          <div className="surface p-6 sm:p-8">
            <p className="eyebrow">Ownership</p>
            <h2 className="section-title">Assignees</h2>
            <div className="mt-4 grid gap-3">
              {activeAssignees.length ? (
                activeAssignees.map((assignee) => (
                  <div
                    key={assignee.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 p-3"
                  >
                    <p className="font-semibold text-emerald-950">
                      {assignee.displayName}
                    </p>
                    {shouldShowRole(assignee.displayName, assignee.roleLabel) ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {assignee.roleLabel}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-600">No active assignees.</p>
              )}
            </div>
          </div>
        </section>

        {canStart || canAddProgress || canComplete ? (
          <section className="mt-8">
            <p className="eyebrow">Actions</p>
            <h2 className="section-title">Update task</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {canStart ? (
                <form action={startCommitteeTaskAction} className="surface p-6">
                  <input type="hidden" name="taskId" value={task.id} />
                  <h3 className="font-semibold text-emerald-950">Begin work</h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    Move this task from Assigned to In progress.
                  </p>
                  <div className="mt-5">
                    <WorkSubmitButton
                      label="Start task"
                      pendingLabel="Starting..."
                      confirmMessage="Start this task?"
                    />
                  </div>
                </form>
              ) : null}

              {canAddProgress ? (
                <form
                  action={addCommitteeTaskProgressAction}
                  className="surface p-6"
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <h3 className="font-semibold text-emerald-950">
                    Add progress
                  </h3>
                  <label className="field-label mt-4">
                    Progress note
                    <textarea
                      name="remark"
                      required
                      maxLength={5000}
                      rows={4}
                      className="field-input resize-y"
                      placeholder="Record a concise update."
                    />
                  </label>
                  <div className="mt-4">
                    <WorkSubmitButton
                      label="Add progress"
                      pendingLabel="Adding..."
                    />
                  </div>
                </form>
              ) : null}

              {canComplete ? (
                <form
                  action={completeCommitteeTaskAction}
                  className="surface p-6 lg:col-span-2"
                >
                  <input type="hidden" name="taskId" value={task.id} />
                  <h3 className="font-semibold text-emerald-950">
                    Complete task
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    Completion notes are optional. Completed tasks become
                    immutable.
                  </p>
                  <label className="field-label mt-4">
                    Completion notes
                    <textarea
                      name="completionNotes"
                      maxLength={5000}
                      rows={4}
                      className="field-input resize-y"
                      placeholder="Summarize the completed work."
                    />
                  </label>
                  <div className="mt-4">
                    <WorkSubmitButton
                      label="Complete task"
                      pendingLabel="Completing..."
                      confirmMessage="Complete this task? This action cannot be reversed."
                    />
                  </div>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <p className="eyebrow">History</p>
          <h2 className="section-title">Activity and progress</h2>
          {task.activity.length ? (
            <ol className="surface mt-5 divide-y divide-zinc-100">
              {[...task.activity].reverse().map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
              ))}
            </ol>
          ) : (
            <div className="surface mt-5 p-6 text-sm text-zinc-600">
              No activity has been recorded.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Notice({ copy, tone = "success" }: { copy: string; tone?: "success" | "error" }) {
  return (
    <div
      className={`mt-6 rounded-xl border p-4 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {copy}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

function ActivityRow({ activity }: { activity: CommitteeTaskActivity }) {
  return (
    <li className="p-5 sm:px-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-emerald-950">
          {activityLabel(activity.activityType)}
        </p>
        <time className="text-xs text-zinc-500">
          {formatTimestamp(activity.createdAt)}
        </time>
      </div>
      {activity.remark ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
          {activity.remark}
        </p>
      ) : null}
    </li>
  );
}

function activityLabel(type: string) {
  return (
    {
      task_created: "Task created",
      task_updated: "Task updated",
      progress_added: "Progress added",
      status_changed: "Status changed",
      task_completed: "Task completed",
    }[type] ?? type.replaceAll("_", " ")
  );
}

function statusLabel(status: CommitteeTaskStatus) {
  return status === "in_progress"
    ? "In progress"
    : status === "completed"
      ? "Completed"
      : "Assigned";
}

function statusClass(status: CommitteeTaskStatus) {
  return `status-badge ${
    status === "completed"
      ? "status-active"
      : status === "in_progress"
        ? "status-warning"
        : ""
  }`;
}

function priorityLabel(priority: CommitteeTaskPriority) {
  return `${priority[0].toUpperCase()}${priority.slice(1)} priority`;
}

function priorityClass(priority: CommitteeTaskPriority) {
  return `status-badge ${priority === "high" ? "status-warning" : ""}`;
}

function shouldShowRole(displayName: string, roleLabel: string) {
  return displayName.trim().toLocaleLowerCase() !== roleLabel.trim().toLocaleLowerCase();
}

function formatTaskDate(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function errorMessage(error: string) {
  return (
    {
      progress_failed: "Progress could not be added.",
      start_failed: "The task could not be started.",
      complete_failed: "The task could not be completed.",
    }[error] ?? "The requested task action could not be completed."
  );
}
