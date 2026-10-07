import {
  formatUnreadBadge,
  getMyUnreadNotificationCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  notificationInvalidationKeys,
  notificationKindLabel,
  notificationListQueryKey,
  notificationUnreadCountQueryKey,
  safeNotificationTarget,
} from "./notifications";
import { supabase } from "../lib/supabase";

jest.mock("../lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

const rpc = supabase.rpc as jest.Mock;

const notificationRow = {
  id: "96000000-0000-0000-0000-000000000001",
  actor_application_user_id: "96000000-0000-0000-0000-000000000002",
  kind: "task_assigned",
  title: "New committee task",
  body: "You were assigned Prepare hall.",
  target_path: "/work/97000000-0000-0000-0000-000000000001",
  source_type: "committee_task",
  source_entity_id: "97000000-0000-0000-0000-000000000001",
  source_activity_id: null,
  metadata: { priority: "high" },
  read_at: null,
  created_at: "2026-10-07T03:00:00Z",
};

beforeEach(() => {
  rpc.mockReset();
});

describe("mobile notification trusted RPC layer", () => {
  it("lists durable notifications through the personal RPC only", async () => {
    rpc.mockResolvedValueOnce({
      data: [notificationRow],
      error: null,
    });

    const result = await listMyNotifications("unread");

    expect(rpc).toHaveBeenCalledWith("list_my_notifications", {
      p_limit: 50,
      p_offset: 0,
      p_unread_only: true,
    });

    expect(result).toEqual([
      {
        id: notificationRow.id,
        actorApplicationUserId: notificationRow.actor_application_user_id,
        kind: "task_assigned",
        title: notificationRow.title,
        body: notificationRow.body,
        targetPath: notificationRow.target_path,
        sourceType: "committee_task",
        sourceEntityId: notificationRow.source_entity_id,
        sourceActivityId: null,
        metadata: { priority: "high" },
        readAt: null,
        createdAt: notificationRow.created_at,
      },
    ]);
  });

  it("reads the unread count through the personal RPC and normalizes it", async () => {
    rpc.mockResolvedValueOnce({ data: 7, error: null });

    await expect(getMyUnreadNotificationCount()).resolves.toBe(7);

    expect(rpc).toHaveBeenCalledWith(
      "get_my_unread_notification_count",
    );
  });

  it("marks one notification and all notifications through trusted RPCs", async () => {
    rpc
      .mockResolvedValueOnce({
        data: notificationRow.id,
        error: null,
      })
      .mockResolvedValueOnce({
        data: 4,
        error: null,
      });

    await expect(
      markMyNotificationRead(notificationRow.id),
    ).resolves.toBe(notificationRow.id);

    await expect(markAllMyNotificationsRead()).resolves.toBe(4);

    expect(rpc.mock.calls).toEqual([
      [
        "mark_my_notification_read",
        { p_notification_id: notificationRow.id },
      ],
      ["mark_all_my_notifications_read"],
    ]);
  });

  it("uses account-scoped query keys for notification invalidation", () => {
    expect(notificationListQueryKey("actor-1", "all")).toEqual([
      "notifications",
      "actor-1",
      "all",
    ]);

    expect(notificationUnreadCountQueryKey("actor-1")).toEqual([
      "notifications",
      "actor-1",
      "unread-count",
    ]);

    expect(notificationInvalidationKeys("actor-1")).toEqual([
      ["notifications", "actor-1", "all"],
      ["notifications", "actor-1", "unread"],
      ["notifications", "actor-1", "unread-count"],
    ]);
  });

  it("accepts only safe internal notification targets", () => {
    expect(safeNotificationTarget("/work/task-1")).toBe(
      "/work/task-1",
    );
    expect(
      safeNotificationTarget("/work/task-1?from=notifications"),
    ).toBe("/work/task-1?from=notifications");

    expect(safeNotificationTarget("https://example.com")).toBe(
      "/notifications",
    );
    expect(safeNotificationTarget("//example.com")).toBe(
      "/notifications",
    );
    expect(safeNotificationTarget("/\\example.com")).toBe(
      "/notifications",
    );
    expect(safeNotificationTarget(null)).toBe("/notifications");
  });

  it("formats the unread badge safely", () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(12)).toBe("12");
    expect(formatUnreadBadge(100)).toBe("99+");
    expect(formatUnreadBadge(Number.NaN)).toBeNull();
  });

  it("labels all current durable task notification kinds", () => {
    expect(
      [
        "task_assigned",
        "task_unassigned",
        "task_updated",
        "task_progress",
        "task_started",
        "task_completed",
      ].map(notificationKindLabel),
    ).toEqual([
      "Task assigned",
      "Task unassigned",
      "Task updated",
      "Task progress",
      "Task started",
      "Task completed",
    ]);

    expect(notificationKindLabel("future_kind")).toBe("Notification");
  });

  it("surfaces backend RPC failures", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "not_authenticated" },
    });

    await expect(listMyNotifications()).rejects.toThrow(
      "not_authenticated",
    );
  });
});
