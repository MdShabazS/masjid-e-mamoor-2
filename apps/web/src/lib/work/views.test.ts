import { describe, expect, it } from "vitest";

import type { CommitteeTaskListItem } from "./server";
import {
  buildCommitteeTaskWorkspace,
  isCommitteeTaskOverdue,
  sortCommitteeTasks,
} from "./views";

const currentUserId = "00000000-0000-4000-8000-000000000001";
const otherUserId = "00000000-0000-4000-8000-000000000002";

function task(
  input: Partial<CommitteeTaskListItem> & Pick<CommitteeTaskListItem, "id">,
): CommitteeTaskListItem {
  return {
    id: input.id,
    title: input.title ?? `Task ${input.id}`,
    description: input.description ?? null,
    priority: input.priority ?? "normal",
    status: input.status ?? "assigned",
    dueDate: input.dueDate ?? null,
    createdByApplicationUserId: otherUserId,
    completedByApplicationUserId: input.completedByApplicationUserId ?? null,
    completedAt: input.completedAt ?? null,
    createdAt: input.createdAt ?? "2026-10-01T08:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-10-01T08:00:00.000Z",
    assigneeIds: input.assigneeIds ?? [currentUserId],
    assignees: input.assignees ?? [
      {
        id: `assignee-${input.id}`,
        applicationUserId: currentUserId,
        displayName: "Current User",
        roleLabel: "Committee Member",
        assignedAt: "2026-10-01T08:00:00.000Z",
        removedAt: null,
      },
    ],
  };
}

describe("committee task workspace", () => {
  it("defaults assign-capable users to all active tasks", () => {
    const result = buildCommitteeTaskWorkspace({
      tasks: [
        task({ id: "assigned" }),
        task({ id: "progress", status: "in_progress" }),
        task({ id: "completed", status: "completed" }),
      ],
      applicationUserId: currentUserId,
      canAssign: true,
    });

    expect(result.view).toBe("all");
    expect(result.status).toBe("active");
    expect(result.tasks.map((item) => item.id)).toEqual([
      "assigned",
      "progress",
    ]);
    expect(result.counts).toEqual({
      active: 2,
      assigned: 1,
      inProgress: 1,
      completed: 1,
    });
  });

  it("forces non-assigners to My Tasks and ignores removed assignments", () => {
    const result = buildCommitteeTaskWorkspace({
      tasks: [
        task({ id: "mine" }),
        task({
          id: "removed",
          assigneeIds: [],
          assignees: [
            {
              id: "removed-assignee",
              applicationUserId: currentUserId,
              displayName: "Current User",
              roleLabel: "Finance",
              assignedAt: "2026-10-01T08:00:00.000Z",
              removedAt: "2026-10-02T08:00:00.000Z",
            },
          ],
        }),
        task({
          id: "someone-else",
          assigneeIds: [otherUserId],
          assignees: [
            {
              id: "other-assignee",
              applicationUserId: otherUserId,
              displayName: "Other User",
              roleLabel: "Secretary",
              assignedAt: "2026-10-01T08:00:00.000Z",
              removedAt: null,
            },
          ],
        }),
      ],
      applicationUserId: currentUserId,
      canAssign: false,
      requestedView: "all",
      requestedStatus: "all",
    });

    expect(result.view).toBe("mine");
    expect(result.tasks.map((item) => item.id)).toEqual(["mine"]);
  });

  it("supports every approved status filter", () => {
    const tasks = [
      task({ id: "assigned" }),
      task({ id: "progress", status: "in_progress" }),
      task({ id: "completed", status: "completed" }),
    ];

    for (const [status, expected] of [
      ["assigned", ["assigned"]],
      ["in_progress", ["progress"]],
      ["completed", ["completed"]],
      ["all", ["assigned", "progress", "completed"]],
    ] as const) {
      const result = buildCommitteeTaskWorkspace({
        tasks,
        applicationUserId: currentUserId,
        canAssign: true,
        requestedStatus: status,
      });
      expect(result.tasks.map((item) => item.id)).toEqual(expected);
    }
  });

  it("sorts active dated tasks first, then undated active tasks, then completed", () => {
    const result = sortCommitteeTasks([
      task({ id: "completed", status: "completed", updatedAt: "2026-10-05T00:00:00Z" }),
      task({ id: "undated", updatedAt: "2026-10-04T00:00:00Z" }),
      task({ id: "later", dueDate: "2026-10-10" }),
      task({ id: "overdue", dueDate: "2026-10-02" }),
      task({ id: "nearer", dueDate: "2026-10-06" }),
    ]);

    expect(result.map((item) => item.id)).toEqual([
      "overdue",
      "nearer",
      "later",
      "undated",
      "completed",
    ]);
  });

  it("uses recently updated order as the deterministic fallback", () => {
    const result = sortCommitteeTasks([
      task({ id: "older", dueDate: null, updatedAt: "2026-10-02T00:00:00Z" }),
      task({ id: "newer", dueDate: null, updatedAt: "2026-10-03T00:00:00Z" }),
    ]);

    expect(result.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("marks only unfinished tasks due before today as overdue", () => {
    expect(
      isCommitteeTaskOverdue(
        task({ id: "overdue", dueDate: "2026-10-03" }),
        "2026-10-04",
      ),
    ).toBe(true);
    expect(
      isCommitteeTaskOverdue(
        task({ id: "today", dueDate: "2026-10-04" }),
        "2026-10-04",
      ),
    ).toBe(false);
    expect(
      isCommitteeTaskOverdue(
        task({ id: "done", dueDate: "2026-10-03", status: "completed" }),
        "2026-10-04",
      ),
    ).toBe(false);
  });
});
