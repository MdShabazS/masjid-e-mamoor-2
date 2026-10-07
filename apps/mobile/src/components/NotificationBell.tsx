import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import {
  formatUnreadBadge,
  getMyUnreadNotificationCount,
  notificationUnreadCountQueryKey,
} from "../modules/notifications";
import { colors } from "../theme/colors";

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
      <View style={styles.bell}>
        <View style={styles.bellDome} />
        <View style={styles.bellBase} />
        <View style={styles.clapper} />
      </View>

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
  bell: {
    height: 24,
    position: "relative",
    width: 24,
  },
  bellDome: {
    borderColor: colors.deepEmerald,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 2,
    height: 15,
    left: 5,
    position: "absolute",
    top: 3,
    width: 14,
  },
  bellBase: {
    backgroundColor: colors.deepEmerald,
    height: 2,
    left: 3,
    position: "absolute",
    top: 17,
    width: 18,
  },
  clapper: {
    backgroundColor: colors.deepEmerald,
    borderRadius: 2,
    height: 4,
    left: 10,
    position: "absolute",
    top: 19,
    width: 4,
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
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.7,
  },
});
