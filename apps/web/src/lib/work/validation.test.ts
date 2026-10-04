import { describe, expect, it } from "vitest";

import { committeeTaskDraftSchema } from "./validation";

const validDraft = {
  title: "Prepare volunteer roster",
  description: "Coordinate the approved volunteers.",
  priority: "normal",
  dueDate: "2026-10-09",
  assigneeIds: ["b2d9ff5d-50e3-4d59-9896-173ee8a46aae"],
};

describe("committee task draft validation", () => {
  it("accepts and normalizes a valid draft", () => {
    expect(committeeTaskDraftSchema.parse(validDraft)).toEqual(validDraft);
  });

  it("requires at least one assignee", () => {
    expect(
      committeeTaskDraftSchema.safeParse({
        ...validDraft,
        assigneeIds: [],
      }).success,
    ).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(
      committeeTaskDraftSchema.safeParse({
        ...validDraft,
        dueDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("normalizes an omitted due date to null", () => {
    expect(
      committeeTaskDraftSchema.parse({ ...validDraft, dueDate: "" }).dueDate,
    ).toBeNull();
  });
});
