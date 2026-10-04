import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getCommitteeTask,
  getCommitteeTaskCapabilities,
  listCommitteeTaskAssigneeOptions,
} from "@/lib/work/server";
import { updateCommitteeTaskAction } from "../../actions";
import { TaskForm } from "../../TaskForm";

type EditTaskPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditTaskPage({
  params,
  searchParams,
}: EditTaskPageProps) {
  const [{ id }, query, capabilities] = await Promise.all([
    params,
    searchParams,
    getCommitteeTaskCapabilities(),
  ]);
  if (!capabilities.canAssign) redirect("/work");

  const [task, options] = await Promise.all([
    getCommitteeTask(id),
    listCommitteeTaskAssigneeOptions(),
  ]);
  if (task.status === "completed") redirect(`/work/${task.id}`);

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-emerald-950/10 pb-8">
          <Link
            href={`/work/${task.id}`}
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
          >
            ← Task details
          </Link>
          <p className="eyebrow mt-6">Committee operations</p>
          <h1 className="page-title">Edit task</h1>
          <p className="page-intro">
            Update task details or change the active assignees.
          </p>
        </header>

        {query.error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            The task could not be updated. Please review the details and try
            again.
          </div>
        ) : null}

        <section className="surface mt-8 p-6 sm:p-8">
          <TaskForm
            action={updateCommitteeTaskAction}
            options={options}
            taskId={task.id}
            initial={{
              title: task.title,
              description: task.description ?? "",
              priority: task.priority,
              dueDate: task.dueDate,
              assigneeIds: task.assignees
                .filter((assignee) => assignee.removedAt === null)
                .map((assignee) => assignee.applicationUserId),
            }}
            submitLabel="Save changes"
            pendingLabel="Saving..."
          />
        </section>
      </div>
    </main>
  );
}
