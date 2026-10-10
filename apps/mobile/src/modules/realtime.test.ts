import { foregroundInvalidationKeys, parseRealtimeNotification, realtimeInvalidationKeys } from "./realtime";

jest.mock("../lib/supabase", () => ({ supabase: {} }));

describe("realtime invalidation mapping", () => {
  it("targets only notifications and the affected task", () => {
    const keys = realtimeInvalidationKeys("account-1", {
      sourceType: "committee_task",
      sourceEntityId: "task-1",
    });
    expect(keys).toContainEqual(["committee-tasks", "account-1"]);
    expect(keys).toContainEqual(["committee-tasks", "detail", "task-1"]);
    expect(keys).not.toContainEqual(["committee-meetings", "account-1"]);
  });

  it("maps meeting and announcement events without broad invalidation", () => {
    expect(realtimeInvalidationKeys("a", { sourceType: "committee_meeting", sourceEntityId: "m" })).toContainEqual(["committee-meetings", "detail", "m"]);
    expect(realtimeInvalidationKeys("a", { sourceType: "announcement" })).toContainEqual(["announcements", "a"]);
  });

  it("parses the small private broadcast envelope", () => {
    expect(parseRealtimeNotification({ payload: { kind: "task_started", source_type: "committee_task", source_entity_id: "task-1" } })).toEqual({
      kind: "task_started",
      sourceType: "committee_task",
      sourceEntityId: "task-1",
    });
  });

  it("uses foreground recovery for important landing data", () => {
    const keys = foregroundInvalidationKeys("a");
    expect(keys).toContainEqual(["committee-tasks", "a"]);
    expect(keys).toContainEqual(["committee-meetings", "a"]);
    expect(keys).toContainEqual(["donations", "a"]);
  });
});
