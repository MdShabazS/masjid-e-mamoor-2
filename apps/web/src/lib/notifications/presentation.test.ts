import { describe, expect, it } from "vitest";

import {
  formatUnreadBadge,
  resolveNotificationFilter,
  safeNotificationTarget,
} from "./presentation";

describe("notification presentation", () => {
  it("defaults to all notifications", () => {
    expect(resolveNotificationFilter(undefined)).toBe("all");
  });

  it("supports the unread filter", () => {
    expect(resolveNotificationFilter("unread")).toBe("unread");
  });

  it("falls back to all for an invalid filter", () => {
    expect(resolveNotificationFilter("archived")).toBe("all");
  });

  it("accepts safe application paths", () => {
    expect(safeNotificationTarget("/work/task-id?view=activity")).toBe(
      "/work/task-id?view=activity",
    );
  });

  it("rejects protocol-relative targets", () => {
    expect(safeNotificationTarget("//example.com/work")).toBe(
      "/notifications",
    );
  });

  it("rejects targets that do not begin with a slash", () => {
    expect(safeNotificationTarget("https://example.com/work")).toBe(
      "/notifications",
    );
  });

  it("formats unread badges", () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(7)).toBe("7");
    expect(formatUnreadBadge(99)).toBe("99");
    expect(formatUnreadBadge(100)).toBe("99+");
  });
});
