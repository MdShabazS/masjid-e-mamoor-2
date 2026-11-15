import type { MobileAccount } from "../auth/types";
import { supabase } from "../lib/supabase";
import { loadCapabilities } from "./capabilities";

jest.mock("../lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

const account = (role: MobileAccount["role"]): MobileAccount => ({
  id: "account-id",
  authUserId: "auth-id",
  username: "officer",
  status: "active",
  role,
  mustChangePassword: false,
  memberProfile: null,
});

describe("account administration visibility", () => {
  beforeEach(() => {
    jest.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as never);
  });

  it("reserves account controls for System Admin even when other permissions are true", async () => {
    expect((await loadCapabilities(account("system_admin"))).canManageAccounts).toBe(true);
    expect((await loadCapabilities(account("president"))).canManageAccounts).toBe(false);
    expect((await loadCapabilities(account("vice_president"))).canManageAccounts).toBe(false);
  });
});
