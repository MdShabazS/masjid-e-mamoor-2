import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import {
  formatUnreadBadge,
  getMyUnreadNotificationCount,
  notificationUnreadCountQueryKey,
} from "../modules/notifications";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/tokens";
import { AppIcon } from "./AppIcon";
import { AppText as Text } from "./AppText";

export function NotificationBell() {
  const { account } = useAuth();

  const unread = useQuery({
    queryKey: notificationUnreadCountQueryKey(account?.id),
    queryFn: getMyUnreadNotificationCount,
    enabled: Boolean(account),
  });

  if (!account) return null;

  const count = unread.data ?? 0;
  const badge = formatUnreadBadge(count);

  return (
    <Pressable
      accessibilityLabel={
        count > 0
          ? "Notifications, " + count + " unread"
          : "Notifications"
      }
      accessibilityRole="button"
      onPress={() => router.push("/notifications")}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon color={colors.textStrong} name="bell-outline" size={23} />

      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderColor: colors.surface,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 4,
    position: "absolute",
    right: -5,
    top: -5,
  },
  badgeText: {
    color: colors.surface,
    fontSize: 9,
    fontFamily: fontFamilies.bold,
  },
  pressed: {
    opacity: 0.7,
  },
});
