import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/accounts/server";
import {
  getCommitteeTaskCapabilities,
  listCommitteeTaskItems,
  type CommitteeTaskPriority,
  type CommitteeTaskStatus,
} from "@/lib/work/server";
import {
  buildCommitteeTaskWorkspace,
  isCommitteeTaskOverdue,
  type CommitteeTaskStatusFilter,
  type CommitteeTaskView,
} from "@/lib/work/views";

type WorkPageProps = {
  searchParams: Promise<{ error?: string; view?: string; status?: string }>;
};

export default async function WorkPage({ searchParams }: WorkPageProps) {
  const [params, capabilities, account] = await Promise.all([
    searchParams,
    getCommitteeTaskCapabilities(),
    getCurrentAccount(),
  ]);
  if (!capabilities.canRead || !account) redirect("/dashboard");

  const tasks = await listCommitteeTaskItems();
  const workspace = buildCommitteeTaskWorkspace({
    tasks,
    applicationUserId: account.id,
    canAssign: capabilities.canAssign,
    requestedView: params.view,
    requestedStatus: params.status,
  });
  const today = new Date().toISOString().slice(0, 10);

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

        <section className="mt-8 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-end">
          <div>
            <p className="eyebrow">Task view</p>
            <nav className="mt-3 flex flex-wrap gap-2" aria-label="Task view">
              {capabilities.canAssign ? (
                <>
                  <FilterLink
                    href={workHref("all", workspace.status)}
                    active={workspace.view === "all"}
                  >
                    All Tasks
                  </FilterLink>
                  <FilterLink
                    href={workHref("mine", workspace.status)}
                    active={workspace.view === "mine"}
                  >
                    My Tasks
                  </FilterLink>
                </>
              ) : (
                <span className="rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white">
                  My Tasks
                </span>
              )}
            </nav>
          </div>

          <div className="lg:justify-self-end">
            <p className="eyebrow">Status</p>
            <nav className="mt-3 flex flex-wrap gap-2" aria-label="Task status">
              {statusFilters.map((filter) => (
                <FilterLink
                  key={filter.value}
                  href={workHref(workspace.view, filter.value)}
                  active={workspace.status === filter.value}
                >
                  {filter.label}
                </FilterLink>
              ))}
            </nav>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TaskMetric label="Active" value={workspace.counts.active} />
          <TaskMetric label="Assigned" value={workspace.counts.assigned} />
          <TaskMetric
            label="In progress"
            value={workspace.counts.inProgress}
          />
          <TaskMetric label="Completed" value={workspace.counts.completed} />
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Task list</p>
              <h2 className="section-title">
                {workspace.view === "all" ? "All Tasks" : "My Tasks"}
              </h2>
            </div>
            <p className="text-sm text-zinc-500">
              {workspace.tasks.length}{" "}
              {workspace.tasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>

          {workspace.tasks.length === 0 ? (
            <div className="surface mt-5 p-8 text-center">
              <h3 className="font-semibold text-emerald-950">No matching tasks</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-600">
                Try another status filter
                {workspace.view === "mine"
                  ? ", or check again when work is assigned to you."
                  : ", or create a task when work is ready to be assigned."}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {workspace.tasks.map((task) => {
                const activeAssignees = task.assignees.filter(
                  (assignee) => assignee.removedAt === null,
                );
                const overdue = isCommitteeTaskOverdue(task, today);
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
                        {overdue ? (
                          <span className="status-badge border-red-200 bg-red-50 text-red-700">
                            Overdue
                          </span>
                        ) : null}
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
                        <dd
                          className={`mt-1 ${
                            overdue ? "font-semibold text-red-700" : "text-zinc-800"
                          }`}
                        >
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

const statusFilters: {
  value: CommitteeTaskStatusFilter;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All statuses" },
];

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-emerald-950 bg-emerald-950 text-white"
          : "border-emerald-950/15 bg-white text-emerald-950 hover:border-emerald-700/40 hover:bg-emerald-50"
      }`}
    >
      {children}
    </Link>
  );
}

function TaskMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface px-4 py-4 sm:px-5">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-emerald-950">{value}</p>
    </div>
  );
}

function workHref(
  view: CommitteeTaskView,
  status: CommitteeTaskStatusFilter,
) {
  const query = new URLSearchParams({ view, status });
  return `/work?${query.toString()}`;
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
