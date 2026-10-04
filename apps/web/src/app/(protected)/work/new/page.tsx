import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getCommitteeTaskCapabilities,
  listCommitteeTaskAssigneeOptions,
} from "@/lib/work/server";
import { createCommitteeTaskAction } from "../actions";
import { TaskForm } from "../TaskForm";

type NewTaskPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewTaskPage({
  searchParams,
}: NewTaskPageProps) {
  const [params, capabilities] = await Promise.all([
    searchParams,
    getCommitteeTaskCapabilities(),
  ]);
  if (!capabilities.canAssign) redirect("/work");

  const options = await listCommitteeTaskAssigneeOptions();

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-emerald-950/10 pb-8">
          <Link
            href="/work"
            className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
          >
            ← Work
          </Link>
          <p className="eyebrow mt-6">Committee operations</p>
          <h1 className="page-title">Create task</h1>
          <p className="page-intro">
            Define the work and assign it to eligible active users.
          </p>
        </header>

        {params.error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {params.error === "invalid_task"
              ? "Check the task details and select at least one assignee."
              : "The task could not be created. Please try again."}
          </div>
        ) : null}

        <section className="surface mt-8 p-6 sm:p-8">
          <TaskForm
            action={createCommitteeTaskAction}
            options={options}
            submitLabel="Create task"
            pendingLabel="Creating task..."
          />
        </section>
      </div>
    </main>
  );
}
