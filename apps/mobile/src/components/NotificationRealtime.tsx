import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "../lib/supabase";
import {
  foregroundInvalidationKeys,
  parseRealtimeNotification,
  realtimeInvalidationKeys,
} from "../modules/realtime";

const REFRESH_DEBOUNCE_MS = 150;

export function NotificationRealtime({
  applicationUserId,
}: {
  applicationUserId: string;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const topic = "notifications:" + applicationUserId;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    let pendingKeys: readonly (readonly unknown[])[] = [];

    const scheduleRefresh = (keys: readonly (readonly unknown[])[]) => {
      if (disposed) return;

      pendingKeys = deduplicateKeys([...pendingKeys, ...keys]);

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (disposed) return;

        const keysToRefresh = pendingKeys;
        pendingKeys = [];

        void Promise.all(
          keysToRefresh.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }, REFRESH_DEBOUNCE_MS);
    };

    const refreshFromEvent = (payload: unknown) => {
      const event = parseRealtimeNotification(payload);
      scheduleRefresh(realtimeInvalidationKeys(applicationUserId, event));
    };

    const refreshOnForeground = () => {
      scheduleRefresh(foregroundInvalidationKeys(applicationUserId));
    };

    const channel = supabase
      .channel(topic, {
        config: {
          private: true,
        },
      })
      .on(
        "broadcast",
        {
          event: "notification_created",
        },
        refreshFromEvent,
      );

    const foregroundSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          refreshOnForeground();
        }
      },
    );

    void (async () => {
      try {
        await supabase.realtime.setAuth();
      } catch {
        return;
      }

      if (!disposed) {
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            refreshOnForeground();
          }
        });
      }
    })();

    return () => {
      disposed = true;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      foregroundSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [applicationUserId, queryClient]);

  return null;
}

function deduplicateKeys(keys: readonly (readonly unknown[])[]) {
  const seen = new Set<string>();

  return keys.filter((key) => {
    const serialized = JSON.stringify(key);
    if (seen.has(serialized)) return false;
    seen.add(serialized);
    return true;
  });
}
