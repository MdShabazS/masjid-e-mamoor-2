import { getAuthRoute } from "./types";

describe("mobile auth routing", () => {
  it("requires sign-in without a session", () => {
    expect(getAuthRoute({ hasSession: false, mustChangePassword: false })).toBe("sign-in");
  });

  it("cannot bypass a forced password change", () => {
    expect(getAuthRoute({ hasSession: true, mustChangePassword: true })).toBe("change-password");
  });

  it("opens the app after password setup", () => {
    expect(getAuthRoute({ hasSession: true, mustChangePassword: false })).toBe("app");
  });
});
