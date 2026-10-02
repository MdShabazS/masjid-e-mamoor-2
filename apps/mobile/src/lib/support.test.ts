import { buildSupportEmailUrl, SUPPORT_EMAIL } from "./support";

describe("support email", () => {
  it("uses the configured support address and privacy-safe diagnostics", () => {
    const url = buildSupportEmailUrl({
      appVersion: "1.0.0",
      buildVersion: "42",
      platform: "android",
      osVersion: "16",
      role: "President",
    });

    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?`)).toBe(true);

    const decoded = decodeURIComponent(url);

    expect(decoded).toContain("Masjid E Mamoor 2 - Support Request");
    expect(decoded).toContain("App version: 1.0.0");
    expect(decoded).toContain("Build: 42");
    expect(decoded).toContain("Platform: android");
    expect(decoded).toContain("OS version: 16");
    expect(decoded).toContain("Role: President");

    expect(decoded).not.toContain("username");
    expect(decoded).not.toContain("password:");
    expect(decoded).not.toContain("token:");
  });
});
