import { parseLoginResponse, parseProvisionResponse } from "./mobile-api";

describe("mobile login response handling", () => {
  it("accepts only the safe token response shape", () => {
    expect(
      parseLoginResponse({
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: null,
        expiresIn: 3600,
        mustChangePassword: true,
      }),
    ).toMatchObject({ mustChangePassword: true });
    expect(parseLoginResponse({ accessToken: "access" })).toBeNull();
  });

  it("accepts a one-time credential response without requiring persistence", () => {
    expect(parseProvisionResponse({ temporaryPassword: "TempPass1!" })).toEqual({ temporaryPassword: "TempPass1!" });
    expect(parseProvisionResponse({ temporaryPassword: 42 })).toBeNull();
  });
});
