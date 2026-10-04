import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getCommitteeTaskCapabilities,
  listCommitteeTaskItems,
  type CommitteeTaskPriority,
  type CommitteeTaskStatus,
} from "@/lib/work/server";

type WorkPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function WorkPage({ searchParams }: WorkPageProps) {
  const [params, capabilities] = await Promise.all([
    searchParams,
    getCommitteeTaskCapabilities(),
  ]);
  if (!capabilities.canRead) redirect("/dashboard");

  const tasks = await listCommitteeTaskItems();

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-emerald-950/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
            >
              ← Dashboard
            </Link>
            <p className="eyebrow mt-6">Committee operations</p>
            <h1 className="page-title">Work</h1>
            <p className="page-intro">
              {capabilities.canAssign
                ? "Create, assign, and manage committee tasks."
                : "Review and update your assigned committee tasks."}
            </p>
          </div>

          {capabilities.canAssign ? (
            <Link href="/work/new" className="button-primary w-fit">
              Create task
            </Link>
          ) : null}
        </header>

        {params.error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            The requested task action could not be completed.
          </div>
        ) : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Task list</p>
              <h2 className="section-title">Authorized tasks</h2>
            </div>
            <p className="text-sm text-zinc-500">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>

          {tasks.length === 0 ? (
            <div className="surface mt-5 p-8 text-center">
              <h3 className="font-semibold text-emerald-950">
                No tasks available
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-600">
                {capabilities.canAssign
                  ? "Create a committee task when work is ready to be assigned."
                  : "Tasks assigned to you will appear here."}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {tasks.map((task) => {
                const activeAssignees = task.assignees.filter(
                  (assignee) => assignee.removedAt === null,
                );
                return (
                  <Link
                    key={task.id}
                    href={`/work/${task.id}`}
                    className="surface block p-5 transition hover:border-emerald-700/40 hover:shadow-md sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-emerald-950">
                        {task.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <span className={statusClass(task.status)}>
                          {statusLabel(task.status)}
                        </span>
                        <span className={priorityClass(task.priority)}>
                          {priorityLabel(task.priority)}
                        </span>
                      </div>
                    </div>

                    {task.description ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600">
                        {task.description}
                      </p>
                    ) : null}

                    <dl className="mt-5 grid gap-3 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase text-zinc-500">
                          Due date
                        </dt>
                        <dd className="mt-1 text-zinc-800">
                          {formatTaskDate(task.dueDate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase text-zinc-500">
                          Assignees
                        </dt>
                        <dd className="mt-1 text-zinc-800">
                          {activeAssignees.length
                            ? activeAssignees
                                .map((assignee) => assignee.displayName)
                                .join(", ")
                            : `${task.assigneeIds.length} assigned`}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
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

function formatTaskDate(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}
