import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";

import { useAuth } from "../auth/AuthProvider";
import { jummahAttendanceQueryKey, syncQueuedJummahAttendance } from "../modules/jummah-attendance";

export function JummahAttendanceSync() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const applicationUserId = account?.id;
    if (!applicationUserId) return;
    let mounted = true;

    const syncWhenOnline = async (isConnected: boolean | null | undefined, isReachable: boolean | null | undefined) => {
      if (!mounted || isConnected !== true || isReachable === false) return;
      const result = await syncQueuedJummahAttendance(applicationUserId);
      if (mounted && (result.applied > 0 || result.rejected > 0)) {
        await queryClient.invalidateQueries({
          queryKey: jummahAttendanceQueryKey(applicationUserId),
        });
      }
    };

    void Network.getNetworkStateAsync().then((state) =>
      syncWhenOnline(state.isConnected, state.isInternetReachable),
    ).catch(() => undefined);

    const networkSubscription = Network.addNetworkStateListener((state) => {
      void syncWhenOnline(state.isConnected, state.isInternetReachable).catch(() => undefined);
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void Network.getNetworkStateAsync().then((network) =>
          syncWhenOnline(network.isConnected, network.isInternetReachable),
        ).catch(() => undefined);
      }
    });

    return () => {
      mounted = false;
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [account?.id, queryClient]);

  return null;
}
