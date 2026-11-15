import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import { registerCurrentPushDevice } from "../modules/notification-push";
import { safeNotificationTarget } from "../modules/notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationPushRegistration() {
  const { account, session } = useAuth();
  const router = useRouter();
  const applicationUserId = account?.id;
  const accountStatus = account?.status;
  const mustChangePassword = account?.mustChangePassword;
  const authUserId = session?.user.id;
  const [pendingTarget, setPendingTarget] = useState<{ id: string; path: string } | null>(null);
  const lastResponseId = useRef<string | null>(null);
  const lastRoutedResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!authUserId || !applicationUserId || accountStatus !== "active" || mustChangePassword) {
      return;
    }

    let mounted = true;
    const register = async (requestPermission: boolean) => {
      try {
        if (!requestPermission) {
          const current = await Notifications.getPermissionsAsync();
          if (current.status !== "granted") return;
        }
        await registerCurrentPushDevice();
      } catch {
        // Push registration is best-effort; in-app notifications remain available.
      }
    };

    void register(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && mounted) void register(false);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [accountStatus, applicationUserId, authUserId, mustChangePassword]);

  useEffect(() => {
    const openResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (lastResponseId.current === id) return;
      lastResponseId.current = id;

      const rawTarget = response.notification.request.content.data?.target_path;
      const target = safeNotificationTarget(
        typeof rawTarget === "string" ? rawTarget : null,
      );
      setPendingTarget({ id, path: target });
    };

    void Notifications.getLastNotificationResponseAsync().then(openResponse).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      !pendingTarget ||
      lastRoutedResponseId.current === pendingTarget.id ||
      !authUserId ||
      !applicationUserId ||
      mustChangePassword
    ) return;
    lastRoutedResponseId.current = pendingTarget.id;
    router.push(pendingTarget.path as never);
  }, [applicationUserId, authUserId, mustChangePassword, pendingTarget, router]);

  return null;
}
