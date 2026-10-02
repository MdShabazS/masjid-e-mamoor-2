import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/accounts/server", () => ({
  changeAccountRole: vi.fn(),
  changeAccountStatus: vi.fn(),
  changeAccountUsername: vi.fn(),
  createAccount: vi.fn(),
  listAccounts: vi.fn(),
  resetAccountPassword: vi.fn(),
}));

import {
  changeAccountRole,
  changeAccountStatus,
  createAccount,
  listAccounts,
} from "@/lib/accounts/server";
import { GET } from "./route";
import { POST as createPOST } from "./create/route";
import { POST as usernamePOST } from "./change-username/route";
import { POST as resetPasswordPOST } from "./reset-password/route";
import { POST as rolePOST } from "./change-role/route";
import { POST as statusPOST } from "./change-status/route";

const token = "mobile-access-token";
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

function request(path: string, body?: unknown) {
  return new Request(`https://example.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function unauthenticatedPost(path: string) {
  return new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

describe("mobile account API security boundary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a generic no-store 401 from every endpoint without bearer auth", async () => {
    const responses = await Promise.all([
      GET(request("/api/mobile/accounts")),
      createPOST(unauthenticatedPost("/api/mobile/accounts/create")),
      usernamePOST(
        unauthenticatedPost("/api/mobile/accounts/change-username"),
      ),
      resetPasswordPOST(
        unauthenticatedPost("/api/mobile/accounts/reset-password"),
      ),
      rolePOST(unauthenticatedPost("/api/mobile/accounts/change-role")),
      statusPOST(unauthenticatedPost("/api/mobile/accounts/change-status")),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "request_failed" });
    }
  });

  it("returns only safe directory fields with no-store caching", async () => {
    vi.mocked(listAccounts).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        authUserId: "private-auth-id",
        username: "member.user",
        usernameNormalized: "member.user",
        status: "active",
        role: "member",
        mustChangePassword: false,
        credentialUpdatedAt: "2026-09-30T00:00:00.000Z",
        createdAt: "2026-09-29T00:00:00.000Z",
        displayName: "Member User",
      },
    ]);

    const response = await GET(
      new Request("https://example.test/api/mobile/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(listAccounts).toHaveBeenCalledWith(token);
    expect(body.accounts[0]).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      username: "member.user",
      status: "active",
      role: "member",
      mustChangePassword: false,
      credentialUpdatedAt: "2026-09-30T00:00:00.000Z",
      createdAt: "2026-09-29T00:00:00.000Z",
      displayName: "Member User",
    });
    expect(JSON.stringify(body)).not.toContain("authUserId");
    expect(JSON.stringify(body)).not.toContain("auth_login_email");
    expect(JSON.stringify(body)).not.toContain("usernameNormalized");
  });

  it("maps trusted-server authorization rejection to a generic 403", async () => {
    vi.mocked(listAccounts).mockRejectedValue(new Error("not_authorized"));

    const response = await GET(
      new Request("https://example.test/api/mobile/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "request_failed" });
  });

  it("rejects invalid create input and System Admin provisioning", async () => {
    const invalid = await createPOST(
      request("/api/mobile/accounts/create", { role: "member" }),
    );
    const systemAdmin = await createPOST(
      request("/api/mobile/accounts/create", {
        username: "second.admin",
        role: "system_admin",
      }),
    );
    const missingDisplayName = await createPOST(
      request("/api/mobile/accounts/create", {
        username: "finance.user",
        role: "finance",
      }),
    );

    expect(invalid.status).toBe(400);
    expect(systemAdmin.status).toBe(400);
    expect(missingDisplayName.status).toBe(400);
    expect(createAccount).not.toHaveBeenCalled();
  });

  it("returns an immediate no-store temporary password on authorized creation", async () => {
    vi.mocked(createAccount).mockResolvedValue({
      accountId: "00000000-0000-4000-8000-000000000002",
      temporaryPassword: "StrongTemp1!",
    });

    const response = await createPOST(
      request("/api/mobile/accounts/create", {
        username: "finance.user",
        role: "finance",
        displayName: "Finance User",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(createAccount).toHaveBeenCalledWith(
      {
        username: "finance.user",
        role: "finance",
        displayName: "Finance User",
      },
      token,
    );
    await expect(response.json()).resolves.toEqual({
      accountId: "00000000-0000-4000-8000-000000000002",
      temporaryPassword: "StrongTemp1!",
    });
  });

  it("keeps protected role and final-admin rejection server-authoritative", async () => {
    vi.mocked(changeAccountRole).mockRejectedValue(
      new Error("not_authorized"),
    );
    vi.mocked(changeAccountStatus).mockRejectedValue(
      new Error("last_system_admin"),
    );

    const roleResponse = await rolePOST(
      request("/api/mobile/accounts/change-role", {
        accountId: "00000000-0000-4000-8000-000000000003",
        role: "president",
      }),
    );
    const statusResponse = await statusPOST(
      request("/api/mobile/accounts/change-status", {
        accountId: "00000000-0000-4000-8000-000000000004",
        status: "deactivated",
      }),
    );

    expect(roleResponse.status).toBe(403);
    expect(statusResponse.status).toBe(403);
    expect(roleResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(statusResponse.headers.get("Cache-Control")).toBe("no-store");
  });
});
