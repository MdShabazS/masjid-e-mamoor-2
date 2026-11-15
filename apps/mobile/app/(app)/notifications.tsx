import { useState } from "react";
import { Alert, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../src/auth/AuthProvider";
import { AppIcon } from "../../src/components/AppIcon";
import { AppText as Text } from "../../src/components/AppText";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../src/components/InstitutionalUI";
import { Screen } from "../../src/components/Screen";
import {
  getMyUnreadNotificationCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  notificationInvalidationKeys,
  notificationKindLabel,
  notificationListQueryKey,
  notificationUnreadCountQueryKey,
  safeNotificationTarget,
  type MobileNotification,
  type NotificationFilter,
} from "../../src/modules/notifications";
import { colors } from "../../src/theme/colors";
import { fontFamilies, radii, spacing, touchTargets } from "../../src/theme/tokens";

export default function NotificationsScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const notifications = useQuery({
    queryKey: notificationListQueryKey(account?.id, filter),
    queryFn: () => listMyNotifications(filter),
    enabled: Boolean(account),
  });
  const unread = useQuery({
    queryKey: notificationUnreadCountQueryKey(account?.id),
    queryFn: getMyUnreadNotificationCount,
    enabled: Boolean(account),
  });

  async function refreshNotificationQueries() {
    if (!account) return;
    await Promise.all(
      notificationInvalidationKeys(account.id).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  }

  const markAll = useMutation({
    mutationFn: markAllMyNotificationsRead,
    onSuccess: refreshNotificationQueries,
    onError: () => Alert.alert("Could not update notifications", "Please try again."),
  });
  const openNotification = useMutation({
    mutationFn: async (notification: MobileNotification) => {
      const changed = notification.readAt === null;
      if (changed) await markMyNotificationRead(notification.id);
      return { changed, target: safeNotificationTarget(notification.targetPath) };
    },
    onSuccess: async ({ changed, target }) => {
      if (changed) await refreshNotificationQueries();
      router.push(target as Href);
    },
    onError: () => Alert.alert("Could not open notification", "Please try again."),
  });

  if (!account) return null;

  const items = notifications.data ?? [];
  const unreadCount = unread.data ?? 0;
  const refreshing = notifications.isRefetching || unread.isRefetching;

  return (
    <Screen
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshNotificationQueries()}
            tintColor={colors.orange}
          />
        ),
      }}
    >
      <BrandedPageHeader
        action={unreadCount > 0 ? (
          <AppButton
            disabled={markAll.isPending}
            label={markAll.isPending ? "Updating..." : "Mark all read"}
            onPress={() => markAll.mutate()}
            variant="secondary"
          />
        ) : undefined}
        description="Updates about committee work and actions relevant to you."
        title="Notifications"
      />

      <View style={styles.filterBar}>
        <View style={styles.segmentedControl}>
          <FilterButton active={filter === "all"} label="All" onPress={() => setFilter("all")} />
          <FilterButton active={filter === "unread"} label="Unread" onPress={() => setFilter("unread")} />
        </View>
        <Text style={styles.unreadCount}>{unreadCount} unread</Text>
      </View>

      {notifications.isLoading ? <LoadingState label="Loading notifications" /> : null}
      {notifications.isError ? (
        <ErrorState
          action={<AppButton label="Retry" onPress={() => void notifications.refetch()} variant="secondary" />}
          description="Notifications could not load. Check your connection and try again."
          title="Notifications unavailable"
        />
      ) : null}
      {!notifications.isLoading && !notifications.isError && items.length === 0 ? (
        <EmptyState
          description={filter === "unread" ? "You have reviewed every update." : "Updates will appear here when available."}
          title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
        />
      ) : null}

      {!notifications.isLoading && !notifications.isError && items.length > 0 ? (
        <View style={styles.notificationSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <AppIcon color={colors.orange} name="bell-outline" size={21} />
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {filter === "unread" ? "Unread updates" : "Recent updates"}
              </Text>
            </View>
            <View style={styles.countBadge}><Text style={styles.countText}>{items.length}</Text></View>
          </View>
          <View style={styles.rows}>
            {items.map((notification) => {
              const isUnread = notification.readAt === null;
              const opening = openNotification.isPending && openNotification.variables?.id === notification.id;

              return (
                <Pressable
                  accessibilityLabel={`Open notification: ${notification.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ busy: opening, disabled: opening }}
                  disabled={opening}
                  key={notification.id}
                  onPress={() => openNotification.mutate(notification)}
                  style={({ pressed }) => [styles.notificationRow, isUnread && styles.unreadRow, pressed && styles.pressed]}
                >
                  <View style={styles.kindIcon}>
                    <AppIcon color={colors.orange} name="bell-badge-outline" size={20} />
                  </View>
                  <View style={styles.notificationCopy}>
                    <View style={styles.titleRow}>
                      <Text numberOfLines={1} style={styles.notificationTitle}>{notification.title}</Text>
                      {isUnread ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : null}
                    </View>
                    <Text numberOfLines={2} style={styles.notificationBody}>{notification.body}</Text>
                    <Text style={styles.notificationMeta}>
                      {opening ? "Opening..." : `${notificationKindLabel(notification.kind)} · ${formatRelativeDate(notification.createdAt)}`}
                    </Text>
                  </View>
                  <AppIcon color={colors.textMuted} name="chevron-right" size={21} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  filterBar: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between", marginTop: spacing.xl },
  segmentedControl: { backgroundColor: colors.surfaceMuted, borderRadius: radii.control, flexDirection: "row", padding: 3 },
  filterButton: { alignItems: "center", borderRadius: 9, justifyContent: "center", minHeight: touchTargets.minimum, minWidth: 72, paddingHorizontal: spacing.md },
  filterButtonActive: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1 },
  filterText: { color: colors.textMuted, fontFamily: fontFamilies.semibold, fontSize: 13 },
  filterTextActive: { color: colors.primaryActionBlue },
  unreadCount: { color: colors.textMuted, fontFamily: fontFamilies.medium, fontSize: 12 },
  notificationSection: { backgroundColor: colors.yellowSurface, borderColor: "#F8E5B7", borderRadius: radii.card, borderWidth: 1, marginTop: spacing.xl, padding: spacing.md },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  sectionTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 17 },
  countBadge: { alignItems: "center", backgroundColor: colors.white, borderRadius: 999, justifyContent: "center", minHeight: 28, minWidth: 28, paddingHorizontal: 8 },
  countText: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 13 },
  rows: { gap: spacing.sm },
  notificationRow: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 76, padding: spacing.md },
  unreadRow: { borderColor: "#C9DFF8" },
  kindIcon: { alignItems: "center", backgroundColor: colors.yellowSurface, borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  notificationCopy: { flex: 1 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  notificationTitle: { color: colors.textStrong, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 19 },
  unreadDot: { backgroundColor: colors.primaryBlue, borderRadius: 4, height: 8, width: 8 },
  notificationBody: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  notificationMeta: { color: colors.textMuted, fontFamily: fontFamilies.medium, fontSize: 11, marginTop: 6 },
  pressed: { opacity: 0.7 },
});
