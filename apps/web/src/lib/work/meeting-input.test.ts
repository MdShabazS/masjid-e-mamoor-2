import { describe, expect, it } from "vitest";
import { indiaMeetingInstant, parseMeetingCreation } from "./meeting-input";
const userId = "8b000000-0000-0000-0000-000000000002";
describe("India meeting creation", () => {
  it("converts local time to the correct UTC instant", () => {
    expect(indiaMeetingInstant("2026-10-14T09:00")).toBe("2026-10-14T03:30:00.000Z");
    expect(indiaMeetingInstant("2026-02-30T09:00")).toBeNull();
  });
  it("requires invitees and a later end", () => {
    const form = new FormData(); form.set("title", "Committee meeting"); form.set("meetingType", "general");
    form.set("start", "2026-10-14T09:00"); form.set("end", "2026-10-14T08:00"); form.append("participant", userId);
    expect(() => parseMeetingCreation(form)).toThrow("invalid_meeting");
    form.set("end", "2026-10-14T10:00");
    expect(parseMeetingCreation(form).participantIds).toEqual([userId]);
  });
});
