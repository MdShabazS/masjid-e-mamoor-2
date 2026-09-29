import { describe, expect, it } from "vitest";
import { getBearerToken } from "./mobile-auth-input";

describe("mobile bearer API boundary", () => {
  it("rejects missing and malformed bearer credentials", () => {
    expect(getBearerToken(new Request("https://example.test"))).toBeNull();
    expect(
      getBearerToken(
        new Request("https://example.test", {
          headers: { authorization: "Basic not-a-bearer" },
        }),
      ),
    ).toBeNull();
  });

  it("extracts only the bearer token value", () => {
    expect(
      getBearerToken(
        new Request("https://example.test", {
          headers: { authorization: "Bearer access-token" },
        }),
      ),
    ).toBe("access-token");
  });
});
