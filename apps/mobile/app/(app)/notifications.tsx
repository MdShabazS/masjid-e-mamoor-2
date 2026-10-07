import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "../../src/auth/AuthProvider";
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
import { spacing } from "../../src/theme/tokens";

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
    onSuccess: async () => {
      await refreshNotificationQueries();
    },
    onError: () => {
      Alert.alert(
        "Could not update notifications",
        "Please try again.",
      );
    },
  });

  const openNotification = useMutation({
    mutationFn: async (notification: MobileNotification) => {
      const unreadNotification = notification.readAt === null;

      if (unreadNotification) {
        await markMyNotificationRead(notification.id);
      }

      return {
        changed: unreadNotification,
        target: safeNotificationTarget(notification.targetPath),
      };
    },
    onSuccess: async ({ changed, target }) => {
      if (changed) {
        await refreshNotificationQueries();
      }

      router.push(target as Href);
    },
    onError: () => {
      Alert.alert(
        "Could not open notification",
        "Please try again.",
      );
    },
  });

  if (!account) return null;

  const items = notifications.data ?? [];
  const unreadCount = unread.data ?? 0;
  const refreshing =
    notifications.isRefetching || unread.isRefetching;

  return (
    <Screen
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshNotificationQueries();
            }}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }

          router.replace("/");
        }}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Home</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PERSONAL UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.intro}>
            Review updates about committee work assigned to you.
          </Text>
        </View>

        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            disabled={markAll.isPending}
            onPress={() => markAll.mutate()}
            style={({ pressed }) => [
              styles.markAllButton,
              (pressed || markAll.isPending) && styles.pressed,
            ]}
          >
            <Text style={styles.markAllText}>
              {markAll.isPending ? "Updating..." : "Mark all read"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filters}>
          <FilterButton
            active={filter === "all"}
            label="All"
            onPress={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "unread"}
            label="Unread"
            onPress={() => setFilter("unread")}
          />
        </View>

        <Text style={styles.unreadCount}>
          {unreadCount} unread
        </Text>
      </View>

      {notifications.isLoading ? (
        <StatePanel loading copy="Loading notifications..." />
      ) : null}

      {notifications.isError ? (
        <StatePanel
          copy="Notifications could not load. Check your connection and try again."
          onRetry={() => void notifications.refetch()}
        />
      ) : null}

      {!notifications.isLoading &&
      !notifications.isError &&
      items.length === 0 ? (
        <StatePanel
          copy={
            filter === "unread"
              ? "You are all caught up."
              : "No notifications yet."
          }
        />
      ) : null}

      {!notifications.isLoading && !notifications.isError
        ? items.map((notification) => {
            const isUnread = notification.readAt === null;
            const opening =
              openNotification.isPending &&
              openNotification.variables?.id === notification.id;

            return (
              <View
                key={notification.id}
                style={[
                  styles.card,
                  isUnread && styles.unreadCard,
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.kindBadge}>
                    <Text style={styles.kindText}>
                      {notificationKindLabel(notification.kind)}
                    </Text>
                  </View>

                  {isUnread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>Unread</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.cardTitle}>
                  {notification.title}
                </Text>

                <Text style={styles.cardBody}>
                  {notification.body}
                </Text>

                <Text style={styles.timestamp}>
                  {formatNotificationDate(notification.createdAt)}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  disabled={opening}
                  onPress={() =>
                    openNotification.mutate(notification)
                  }
                  style={({ pressed }) => [
                    styles.openButton,
                    (pressed || opening) && styles.pressed,
                  ]}
                >
                  <Text style={styles.openButtonText}>
                    {opening ? "Opening..." : "Open"}
                  </Text>
                </Pressable>
              </View>
            );
          })
        : null}
    </Screen>
  );
}

function FilterButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.filterButton,
        active && styles.filterButtonActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          active && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatePanel({
  copy,
  loading = false,
  onRetry,
}: {
  copy: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.statePanel}>
      {loading ? (
        <ActivityIndicator color={colors.deepEmerald} />
      ) : null}

      <Text style={styles.stateCopy}>{copy}</Text>

      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xxl,
    paddingBottom: spacing.section,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingVertical: 6,
  },
  backText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  headerRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 8,
  },
  intro: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  markAllButton: {
    borderColor: colors.deepEmerald,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  markAllText: {
    color: colors.deepEmerald,
    fontSize: 12,
    fontWeight: "700",
  },
  filterRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  filterText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.surface,
  },
  unreadCount: {
    color: colors.secondary,
    fontSize: 12,
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    padding: 24,
  },
  stateCopy: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 10,
    padding: 8,
  },
  retryText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  unreadCard: {
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindBadge: {
    backgroundColor: colors.sand,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  kindText: {
    color: colors.deepEmerald,
    fontSize: 11,
    fontWeight: "700",
  },
  unreadBadge: {
    backgroundColor: colors.deepEmerald,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  unreadBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "800",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 12,
  },
  cardBody: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  timestamp: {
    color: colors.secondary,
    fontSize: 11,
    marginTop: 12,
  },
  openButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: colors.deepEmerald,
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 14,
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  openButtonText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.65,
  },
});
