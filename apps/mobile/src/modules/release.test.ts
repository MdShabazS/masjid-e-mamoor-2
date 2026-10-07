import { supabase } from "../lib/supabase";
import { getMobileReleaseStatus, resolveNativeReleaseIdentity, safeHttpsStoreUrl } from "./release";

jest.mock("../lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;

const releaseRow = {
  platform: "android",
  current_version: "1.0.0",
  latest_version: "1.2.0",
  minimum_supported_version: "1.0.0",
  update_status: "optional",
  store_url: "https://play.google.com/store/apps/details?id=example",
  update_message: "A newer app version is available.",
  policy_updated_at: "2026-10-07T08:00:00Z",
};

beforeEach(() => {
  rpc.mockReset();
});

describe("mobile release compatibility", () => {
  it("maps native Android and iOS release identities", () => {
    expect(resolveNativeReleaseIdentity("android", "1.0.0")).toEqual({
      platform: "android",
      currentVersion: "1.0.0",
    });
    expect(resolveNativeReleaseIdentity("ios", "2.4.1")).toEqual({
      platform: "ios",
      currentVersion: "2.4.1",
    });
  });

  it("fails open for unsupported platforms or invalid native versions", () => {
    expect(resolveNativeReleaseIdentity("web", "1.0.0")).toBeNull();
    expect(resolveNativeReleaseIdentity("android", null)).toBeNull();
    expect(resolveNativeReleaseIdentity("android", "1.0")).toBeNull();
    expect(resolveNativeReleaseIdentity("android", "01.0.0")).toBeNull();
  });

  it("maps the authoritative release-status RPC response", async () => {
    rpc.mockResolvedValueOnce({ data: [releaseRow], error: null });

    await expect(
      getMobileReleaseStatus({
        platform: "android",
        currentVersion: "1.0.0",
      }),
    ).resolves.toEqual({
      platform: "android",
      currentVersion: "1.0.0",
      latestVersion: "1.2.0",
      minimumSupportedVersion: "1.0.0",
      updateStatus: "optional",
      storeUrl: releaseRow.store_url,
      updateMessage: releaseRow.update_message,
      policyUpdatedAt: releaseRow.policy_updated_at,
    });

    expect(rpc).toHaveBeenCalledWith("get_mobile_release_status", {
      p_platform: "android",
      p_current_version: "1.0.0",
    });
  });

  it("does not call the RPC without a supported native identity", async () => {
    await expect(getMobileReleaseStatus(null)).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces RPC and malformed-response failures for fail-open handling", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "network_error" },
      })
      .mockResolvedValueOnce({
        data: [{ ...releaseRow, update_status: "unknown" }],
        error: null,
      });

    await expect(
      getMobileReleaseStatus({
        platform: "android",
        currentVersion: "1.0.0",
      }),
    ).rejects.toThrow("network_error");

    await expect(
      getMobileReleaseStatus({
        platform: "android",
        currentVersion: "1.0.0",
      }),
    ).rejects.toThrow("invalid_release_status");
  });

  it("preserves a required decision when update_message is null", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          ...releaseRow,
          minimum_supported_version: "1.2.0",
          update_status: "required",
          update_message: null,
        },
      ],
      error: null,
    });

    await expect(
      getMobileReleaseStatus({
        platform: "android",
        currentVersion: "1.0.0",
      }),
    ).resolves.toMatchObject({
      updateStatus: "required",
      updateMessage: "A newer version of Masjid E Mamoor 2 is available.",
    });
  });

  it("accepts only the official HTTPS store for each platform", () => {
    expect(
      safeHttpsStoreUrl("https://play.google.com/store/apps/details?id=example", "android"),
    ).toBe("https://play.google.com/store/apps/details?id=example");

    expect(safeHttpsStoreUrl("https://apps.apple.com/in/app/example/id123456789", "ios")).toBe(
      "https://apps.apple.com/in/app/example/id123456789",
    );

    expect(
      safeHttpsStoreUrl("http://play.google.com/store/apps/details?id=example", "android"),
    ).toBeNull();

    expect(safeHttpsStoreUrl("https://example.com/app", "android")).toBeNull();

    expect(safeHttpsStoreUrl("https://apps.apple.com/in/app/example/id123", "android")).toBeNull();

    expect(safeHttpsStoreUrl("masjid://update", "android")).toBeNull();
    expect(safeHttpsStoreUrl(null, "android")).toBeNull();
  });
});
