import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { changePassword as changePasswordRequest, loginWithUsername } from "../lib/mobile-api";
import { registerAuthRefreshListener, supabase } from "../lib/supabase";
import { loadOwnAccount } from "./account";
import type { MobileAccount } from "./types";
import { queryClient } from "../query/QueryProvider";

interface AuthContextValue {
  session: Session | null;
  account: MobileAccount | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  changePassword: (password: string, confirmPassword: string) => Promise<void>;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<MobileAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccount = useCallback(async (nextSession: Session | null) => {
    if (!nextSession) {
      setAccount(null);
      queryClient.clear();
      return;
    }

    const nextAccount = await loadOwnAccount();
    if (!nextAccount || nextAccount.status !== "active") {
      await supabase.auth.signOut();
      setAccount(null);
      queryClient.clear();
      return;
    }
    if (nextAccount.id !== account?.id) queryClient.clear();
    setAccount(nextAccount);
  }, [account?.id]);

  useEffect(() => {
    registerAuthRefreshListener();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      void loadAccount(data.session).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (event === "SIGNED_OUT") {
        setAccount(null);
        queryClient.clear();
        setLoading(false);
        return;
      }
      setTimeout(() => {
        void loadAccount(nextSession).finally(() => {
          if (mounted) setLoading(false);
        });
      }, 0);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      account,
      loading,
      signIn: async (username, password) => {
        const result = await loginWithUsername(username, password);
        const { error } = await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });
        if (error) throw new Error("invalid_credentials");
        const nextAccount = await loadOwnAccount();
        if (!nextAccount) throw new Error("account_unavailable");
        setAccount(nextAccount);
      },
      changePassword: async (password, confirmPassword) => {
        if (!session) throw new Error("not_authenticated");
        await changePasswordRequest(session, password, confirmPassword);
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setAccount(null);
        queryClient.clear();
      },
      refreshAccount: async () => {
        const nextAccount = await loadOwnAccount();
        setAccount(nextAccount);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setAccount(null);
        queryClient.clear();
      },
    }),
    [account, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
