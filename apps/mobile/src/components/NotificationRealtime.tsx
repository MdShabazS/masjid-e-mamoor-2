import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "../lib/supabase";
import { notificationInvalidationKeys } from "../modules/notifications";

const REFRESH_DEBOUNCE_MS = 250;

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

    const refreshNotifications = () => {
      if (disposed) return;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (disposed) return;

        void Promise.all(
          notificationInvalidationKeys(applicationUserId).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }, REFRESH_DEBOUNCE_MS);
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
        refreshNotifications,
      );

    const foregroundSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          refreshNotifications();
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
            refreshNotifications();
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
