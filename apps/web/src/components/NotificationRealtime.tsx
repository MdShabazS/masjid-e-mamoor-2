"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const REFRESH_DEBOUNCE_MS = 250;

export function NotificationRealtime({
  applicationUserId,
}: {
  applicationUserId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const topic = `notifications:${applicationUserId}`;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const refreshNotifications = () => {
      if (disposed) return;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        if (!disposed) {
          router.refresh();
        }
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

      void supabase.removeChannel(channel);
    };
  }, [applicationUserId, router]);

  return null;
}
