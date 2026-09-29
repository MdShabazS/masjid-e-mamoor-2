import { parseLoginResponse } from "./mobile-api";

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
});
