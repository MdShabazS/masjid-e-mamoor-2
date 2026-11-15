import { supabase } from "../lib/supabase";
import * as Location from "expo-location";
import {
  enqueueJummahAttendance,
  markJummahAttendanceApplied,
  markJummahAttendanceRejected,
} from "./jummah-attendance-store";
import {
  createJummahAttendanceEvent,
  getCurrentJummahLocation,
  latestLocalAttendanceByEvent,
  jummahAttendanceEventDraftIdentity,
  listJummahAttendanceEvents,
  mapJummahAttendanceEvent,
  recordSelfJummahAttendance,
  validateJummahAttendanceEventDraft,
} from "./jummah-attendance";

jest.mock("../lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "operation-uuid" }));
jest.mock("./jummah-attendance-store", () => ({
  cacheJummahEvents: jest.fn(),
  enqueueJummahAttendance: jest.fn(),
  getCachedJummahEvents: jest.fn(),
  getQueuedJummahAttendance: jest.fn(),
  markJummahAttendanceApplied: jest.fn(),
  markJummahAttendanceAttempt: jest.fn(),
  markJummahAttendanceRejected: jest.fn(),
}));

const rpc = supabase.rpc as jest.Mock;
const getForegroundPermissionsAsync = Location.getForegroundPermissionsAsync as jest.Mock;
const requestForegroundPermissionsAsync = Location.requestForegroundPermissionsAsync as jest.Mock;
const getCurrentPositionAsync = Location.getCurrentPositionAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Jummah attendance client boundary", () => {
  it("uses the latest local status when an event has multiple attempts", () => {
    const latestByEvent = latestLocalAttendanceByEvent([
      {
        operationId: "newer",
        eventId: "event-1",
        status: "queued",
        errorCode: null,
        recordedAt: null,
        createdAt: "2026-10-12T10:05:00.000Z",
      },
      {
        operationId: "older",
        eventId: "event-1",
        status: "rejected",
        errorCode: "outside_attendance_radius",
        recordedAt: null,
        createdAt: "2026-10-12T10:00:00.000Z",
      },
    ]);

    expect(latestByEvent.get("event-1")?.status).toBe("queued");
  });

  it("validates event window and coordinate ranges before the RPC", () => {
    const base = {
      scheduledFor: new Date("2026-10-16T07:00:00Z"),
      checkinOpensAt: new Date("2026-10-16T06:00:00Z"),
      checkinClosesAt: new Date("2026-10-16T08:00:00Z"),
      centerLatitude: 12.97,
      centerLongitude: 77.59,
    };
    expect(validateJummahAttendanceEventDraft(base)).toBeNull();
    expect(validateJummahAttendanceEventDraft({ ...base, centerLatitude: 91 })).toBe("invalid_event_location");
    expect(validateJummahAttendanceEventDraft({ ...base, checkinClosesAt: base.checkinOpensAt })).toBe("invalid_event_window");
    expect(validateJummahAttendanceEventDraft({ ...base, scheduledFor: new Date(Number.NaN) })).toBe("invalid_event_time");
    expect(jummahAttendanceEventDraftIdentity(base)).toBe(jummahAttendanceEventDraftIdentity({
      ...base,
      scheduledFor: new Date(base.scheduledFor),
    }));
  });

  it("creates events through the trusted RPC using the configured centre and operation id", async () => {
    rpc.mockResolvedValue({ data: [{ event_id: "event-1" }], error: null });
    const draft = {
      scheduledFor: new Date("2026-10-16T07:00:00Z"),
      checkinOpensAt: new Date("2026-10-16T06:00:00Z"),
      checkinClosesAt: new Date("2026-10-16T08:00:00Z"),
      centerLatitude: 12.97,
      centerLongitude: 77.59,
    };

    await expect(createJummahAttendanceEvent(draft, "operation-1")).resolves.toBe("event-1");
    expect(rpc).toHaveBeenCalledWith("create_jummah_attendance_event", expect.objectContaining({
      p_center_latitude: 12.97,
      p_center_longitude: 77.59,
      p_operation_id: "operation-1",
    }));
  });

  it("maps safe event-list fields without exposing the geofence centre", () => {
    expect(mapJummahAttendanceEvent({
      event_id: "event-1",
      scheduled_for: "2026-10-16T07:00:00Z",
      checkin_opens_at: "2026-10-16T06:00:00Z",
      checkin_closes_at: "2026-10-16T08:00:00Z",
      is_open: true,
      my_attendance_recorded_at: null,
    })).toEqual({
      eventId: "event-1",
      scheduledFor: "2026-10-16T07:00:00Z",
      checkinOpensAt: "2026-10-16T06:00:00Z",
      checkinClosesAt: "2026-10-16T08:00:00Z",
      isOpen: true,
      myAttendanceRecordedAt: null,
    });
  });

  it("uses cached events only when the authoritative list RPC fails", async () => {
    const { getCachedJummahEvents } = jest.requireMock("./jummah-attendance-store") as {
      getCachedJummahEvents: jest.Mock;
    };
    rpc.mockResolvedValue({ data: null, error: new Error("offline") });
    getCachedJummahEvents.mockResolvedValue([{ eventId: "cached" }]);
    await expect(listJummahAttendanceEvents("app-user-1")).resolves.toEqual({
      events: [{ eventId: "cached" }],
      source: "cache",
    });
  });

  it("stores offline attendance for later server validation", async () => {
    await expect(recordSelfJummahAttendance({
      applicationUserId: "app-user-1",
      eventId: "event-1",
      latitude: 12.97,
      longitude: 77.59,
      operationId: "operation-1",
      source: "offline",
    })).resolves.toEqual({ status: "queued" });
    expect(enqueueJummahAttendance).toHaveBeenCalledWith(expect.objectContaining({
      ownerApplicationUserId: "app-user-1",
      eventId: "event-1",
      operationId: "operation-1",
    }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the authenticated account as an ownership assertion and clears coordinates after acceptance", async () => {
    rpc.mockResolvedValue({ data: [{
      attendance_record_id: "record-1",
      event_id: "event-1",
      recorded_at: "2026-10-16T06:30:00Z",
      already_recorded: false,
      outcome: "accepted",
      error_code: null,
    }], error: null });

    await expect(recordSelfJummahAttendance({
      applicationUserId: "app-user-1",
      eventId: "event-1",
      latitude: 12.97,
      longitude: 77.59,
      operationId: "operation-1",
      source: "online",
    })).resolves.toEqual({ status: "applied" });
    expect(rpc).toHaveBeenCalledWith("record_self_jummah_attendance", expect.objectContaining({
      p_expected_actor_application_user_id: "app-user-1",
      p_event_id: "event-1",
    }));
    expect(markJummahAttendanceApplied).toHaveBeenCalledWith(
      "operation-1", "record-1", "2026-10-16T06:30:00Z",
    );
  });

  it("persists authoritative rejections instead of retrying them as transient network errors", async () => {
    rpc.mockResolvedValue({ data: [{
      attendance_record_id: null,
      event_id: "event-1",
      recorded_at: null,
      already_recorded: false,
      outcome: "rejected",
      error_code: "attendance_window_closed",
    }], error: null });

    await expect(recordSelfJummahAttendance({
      applicationUserId: "app-user-1",
      eventId: "event-1",
      latitude: 12.97,
      longitude: 77.59,
      operationId: "operation-1",
      source: "online",
    })).rejects.toThrow("attendance_window_closed");
    expect(markJummahAttendanceRejected).toHaveBeenCalledWith(
      "operation-1", "attendance_window_closed",
    );
  });

  it("requests foreground-only location and does not use background tracking", async () => {
    getForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 12.97, longitude: 77.59 } });
    await expect(getCurrentJummahLocation()).resolves.toEqual({ latitude: 12.97, longitude: 77.59 });
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });
});
