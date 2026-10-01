import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./AuthProvider";
import { changePassword as changePasswordRequest } from "../lib/mobile-api";
import { supabase } from "../lib/supabase";
import { loadOwnAccount } from "./account";
import { queryClient } from "../query/QueryProvider";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

jest.mock("../lib/mobile-api", () => ({
  changePassword: jest.fn(),
  loginWithUsername: jest.fn(),
}));
jest.mock("../lib/supabase", () => ({
  registerAuthRefreshListener: jest.fn(),
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      refreshSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));
jest.mock("./account", () => ({ loadOwnAccount: jest.fn() }));
jest.mock("../query/QueryProvider", () => ({
  queryClient: { clear: jest.fn() },
}));

const session = { access_token: "", refresh_token: "" } as Session;
const account = {
  id: "qa-account",
  status: "active",
  mustChangePassword: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  let storedSession: Session | null = session;
  jest.mocked(supabase.auth.getSession).mockImplementation(async () =>
    storedSession
      ? { data: { session: storedSession }, error: null }
      : { data: { session: null }, error: null },
  );
  jest.mocked(supabase.auth.signOut).mockImplementation(async () => {
    storedSession = null;
    return { error: null };
  });
  jest.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>);
  jest.mocked(loadOwnAccount).mockResolvedValue(account as Awaited<ReturnType<typeof loadOwnAccount>>);
});

describe("password change session handling", () => {
  it("clears the old local session after backend success without refreshing it", async () => {
    jest.mocked(changePasswordRequest).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.account?.id).toBe(account.id));

    await act(async () => result.current.changePassword("", ""));

    expect(changePasswordRequest).toHaveBeenCalledWith(session, "", "");
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    await waitFor(() => expect(result.current.session).toBeNull());
    expect(result.current.session).toBeNull();
    expect(result.current.account).toBeNull();
    expect(queryClient.clear).toHaveBeenCalled();
  });

  it("keeps the session when the backend rejects the change", async () => {
    jest.mocked(changePasswordRequest).mockRejectedValue(new Error("request_failed"));
    const { result } = await renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.account?.id).toBe(account.id));

    await expect(act(async () => result.current.changePassword("", ""))).rejects.toThrow();

    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(result.current.session).toBe(session);
  });
});
