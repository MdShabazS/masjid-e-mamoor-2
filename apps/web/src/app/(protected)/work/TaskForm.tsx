import type {
  CommitteeAssigneeOption,
  CommitteeTaskDraft,
} from "@/lib/work/server";
import { WorkSubmitButton } from "./WorkSubmitButton";

type TaskFormProps = {
  action: (formData: FormData) => Promise<void>;
  options: CommitteeAssigneeOption[];
  submitLabel: string;
  pendingLabel: string;
  taskId?: string;
  initial?: CommitteeTaskDraft;
};

export function TaskForm({
  action,
  options,
  submitLabel,
  pendingLabel,
  taskId,
  initial,
}: TaskFormProps) {
  const selected = new Set(initial?.assigneeIds ?? []);

  return (
    <form action={action} className="mt-6 grid gap-5">
      {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}

      <label className="field-label">
        Title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={initial?.title ?? ""}
          className="field-input"
          placeholder="Example: Prepare Friday volunteer roster"
        />
      </label>

      <label className="field-label">
        Description
        <textarea
          name="description"
          maxLength={5000}
          rows={5}
          defaultValue={initial?.description ?? ""}
          className="field-input resize-y"
          placeholder="Describe the expected work and outcome."
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Priority
          <select
            name="priority"
            defaultValue={initial?.priority ?? "normal"}
            className="field-input"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="field-label">
          Due date
          <input
            type="date"
            name="dueDate"
            defaultValue={initial?.dueDate ?? ""}
            className="field-input"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-emerald-950">
          Assignees
        </legend>
        <p className="mt-1 text-sm text-zinc-600">
          Select one or more active users eligible for committee work.
        </p>

        {options.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {options.map((option) => {
              const showRole =
                option.displayName.trim().toLocaleLowerCase() !==
                option.roleLabel.trim().toLocaleLowerCase();
              return (
                <label
                  key={option.applicationUserId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-950/10 bg-white p-3 hover:border-emerald-800/30"
                >
                  <input
                    type="checkbox"
                    name="assigneeIds"
                    value={option.applicationUserId}
                    defaultChecked={selected.has(option.applicationUserId)}
                    className="mt-1 h-4 w-4 accent-emerald-800"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-emerald-950">
                      {option.displayName}
                    </span>
                    {showRole ? (
                      <span className="block text-xs text-zinc-500">
                        {option.roleLabel}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No eligible active assignees are available.
          </p>
        )}
      </fieldset>

      <div>
        <WorkSubmitButton
          label={submitLabel}
          pendingLabel={pendingLabel}
        />
      </div>
    </form>
  );
}
