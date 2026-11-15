import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";

import { useAuth } from "../../src/auth/AuthProvider";
import {
  AppButton,
  ErrorState,
  LoadingState,
} from "../../src/components/InstitutionalUI";
import { NotificationBell } from "../../src/components/NotificationBell";
import { AppIcon, type AppIconName } from "../../src/components/AppIcon";
import { AppText as Text } from "../../src/components/AppText";
import { Screen } from "../../src/components/Screen";
import { loadCapabilities, type MobileCapabilities } from "../../src/modules/capabilities";
import {
  activeDashboardTasks,
  dashboardWorkspaceModules,
  formatDashboardMeetingRange,
  upcomingDashboardMeetings,
} from "../../src/modules/dashboard-presentation";
import {
  committeeMeetingListQueryKey,
  listCommitteeMeetings,
  type CommitteeMeetingSummary,
} from "../../src/modules/meetings";
import {
  listMyNotifications,
  markMyNotificationRead,
  notificationInvalidationKeys,
  notificationListQueryKey,
  safeNotificationTarget,
  type MobileNotification,
} from "../../src/modules/notifications";
import {
  claimOpenCommitteeTask,
  committeeTaskListQueryKey,
  createCommitteeOperationId,
  declineCommitteeTaskAssignment,
  listCommitteeTasks,
  startCommitteeTask,
  type CommitteeTaskSummary,
} from "../../src/modules/work";
import { formatTaskDate } from "../../src/modules/work-presentation";
import { colors } from "../../src/theme/colors";
import { fontFamilies, radii, spacing } from "../../src/theme/tokens";

type TaskHomeAction = "claim" | "start" | "decline";

export default function HomeScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const canReadTasks = capabilities.data?.canReadCommitteeTasks === true;
  const canReadMeetings = capabilities.data?.canReadCommitteeMeetings === true;

  const tasks = useQuery({
    queryKey: committeeTaskListQueryKey(account?.id),
    queryFn: listCommitteeTasks,
    enabled: canReadTasks,
  });

  const meetings = useQuery({
    queryKey: committeeMeetingListQueryKey(account?.id),
    queryFn: listCommitteeMeetings,
    enabled: canReadMeetings,
  });

  const notifications = useQuery({
    queryKey: notificationListQueryKey(account?.id, "unread"),
    queryFn: () => listMyNotifications("unread"),
    enabled: Boolean(account) && capabilities.data?.canReadNotifications === true,
  });

  const taskAction = useMutation({
    mutationFn: async ({
      action,
      task,
    }: {
      action: TaskHomeAction;
      task: CommitteeTaskSummary;
    }) => {
      const operationId = createCommitteeOperationId();

      if (action === "claim") {
        return claimOpenCommitteeTask(task.id, operationId);
      }

      if (action === "decline") {
        return declineCommitteeTaskAssignment(task.id, "", operationId);
      }

      return startCommitteeTask(task.id, operationId);
    },

    onSuccess: async (updatedTask, variables) => {
      if (account) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: committeeTaskListQueryKey(account.id),
          }),
          ...notificationInvalidationKeys(account.id).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        ]);
      }

      if (variables.action === "decline") return;

      router.push({
        pathname: "/work/[id]",
        params: { id: updatedTask.id },
      });
    },

    onError: (error) => {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("task_already_claimed") || message.includes("23505")) {
        Alert.alert(
          "Task already accepted",
          "Another member accepted this task first. The dashboard will refresh.",
        );

        if (account) {
          void queryClient.invalidateQueries({
            queryKey: committeeTaskListQueryKey(account.id),
          });
        }

        return;
      }

      Alert.alert("Task could not be updated", "Please refresh and try again.");
    },
  });

  const openNotification = useMutation({
    mutationFn: async (notification: MobileNotification) => {
      await markMyNotificationRead(notification.id);
      return safeNotificationTarget(notification.targetPath);
    },

    onSuccess: async (target) => {
      if (account) {
        await Promise.all(
          notificationInvalidationKeys(account.id).map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }

      router.push(target as Href);
    },

    onError: () => {
      Alert.alert("Could not open notification", "Please try again.");
    },
  });

  if (!account) return null;

  const refreshAll = async () => {
    await capabilities.refetch();
    await notifications.refetch();

    if (canReadTasks) await tasks.refetch();
    if (canReadMeetings) await meetings.refetch();
  };

  const refreshing =
    capabilities.isRefetching ||
    notifications.isRefetching ||
    tasks.isRefetching ||
    meetings.isRefetching;

  return (
    <Screen
      backgroundColor={colors.dashboardBackground}
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshAll()}
            tintColor={colors.primaryBlue}
          />
        ),
      }}
    >
      <StatusBar style="dark" />

      <DashboardHeader
        notificationBell={
          capabilities.data?.canReadNotifications ? <NotificationBell /> : undefined
        }
      />

      {capabilities.isLoading ? (
        <View style={styles.loadingWrap}>
          <LoadingState label="Preparing your dashboard" />
        </View>
      ) : null}

      {capabilities.isError ? (
        <View style={styles.loadingWrap}>
          <ErrorState
            action={
              <AppButton
                label="Retry"
                onPress={() => void capabilities.refetch()}
                variant="secondary"
              />
            }
            description="Your authorized workspace could not be loaded."
            title="Workspace unavailable"
          />
        </View>
      ) : null}

      {capabilities.data ? (
        <>
          <DashboardContent
            accountId={account.id}
            capabilities={capabilities.data}
            canReadMeetings={canReadMeetings}
            canReadNotifications={capabilities.data.canReadNotifications}
            canReadTasks={canReadTasks}
            meetings={meetings}
            notifications={notifications}
            onNotificationOpen={(notification) => openNotification.mutate(notification)}
            onTaskAction={(task, action) => taskAction.mutate({ action, task })}
            notificationOpeningId={
              openNotification.isPending ? openNotification.variables?.id : undefined
            }
            taskActionId={taskAction.isPending ? taskAction.variables?.task.id : undefined}
            tasks={tasks}
          />
        </>
      ) : null}
    </Screen>
  );
}

function DashboardHeader({ notificationBell }: { notificationBell?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.mosqueIcon}>
          <AppIcon color={colors.successGreen} name="mosque" size={38} />
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Masjid-e-Mamoor</Text>
          <Text style={styles.headerSubtitle}>Assalamu Alaikum</Text>
        </View>
      </View>

      {notificationBell ? <View style={styles.headerBell}>{notificationBell}</View> : null}
    </View>
  );
}

function DashboardContent({
  accountId,
  capabilities,
  canReadMeetings,
  canReadNotifications,
  canReadTasks,
  meetings,
  notificationOpeningId,
  notifications,
  onNotificationOpen,
  onTaskAction,
  taskActionId,
  tasks,
}: {
  accountId: string;
  capabilities: MobileCapabilities;
  canReadMeetings: boolean;
  canReadNotifications: boolean;
  canReadTasks: boolean;
  meetings: UseQueryResult<CommitteeMeetingSummary[], Error>;
  notificationOpeningId?: string;
  notifications: UseQueryResult<MobileNotification[], Error>;
  onNotificationOpen: (notification: MobileNotification) => void;
  onTaskAction: (task: CommitteeTaskSummary, action: TaskHomeAction) => void;
  taskActionId?: string;
  tasks: UseQueryResult<CommitteeTaskSummary[], Error>;
}) {
  const activeTasks = activeDashboardTasks(canReadTasks ? (tasks.data ?? []) : []);

  const myTasks = activeTasks.filter((task) => task.assigneeIds.includes(accountId));

  const openTasks = activeTasks.filter(
    (task) => task.assignmentMode === "open" && task.status === "open",
  );

  const nextMeeting =
    upcomingDashboardMeetings(canReadMeetings ? (meetings.data ?? []) : [])[0];

  const unreadNotifications = (notifications.data ?? []).slice(0, 2);

  const attentionCount =
    myTasks.length +
    openTasks.length +
    unreadNotifications.length +
    (nextMeeting ? 1 : 0);

  const workspaceModules = dashboardWorkspaceModules(capabilities);

  return (
    <View style={styles.dashboardStack}>
      <AttentionBanner count={attentionCount} />

      {canReadTasks ? (
        <DashboardSection
          icon="clipboard-check-outline"
          iconColor={colors.dashboardBlue}
          title="Assigned to you"
          count={myTasks.length}
          backgroundColor={colors.dashboardBlueSurface}
          borderColor={colors.dashboardBlueBorder}
        >
          {myTasks.slice(0, 1).map((task) => (
            <AssignedTaskCard
              key={task.id}
              busy={taskActionId === task.id}
              task={task}
              onAction={(action) => onTaskAction(task, action)}
            />
          ))}
          {myTasks.length === 0 ? (
            <CompactEmptyState
              icon="clipboard-check-outline"
              message="No assigned tasks need your attention."
              title="No assigned tasks"
            />
          ) : null}
        </DashboardSection>
      ) : null}

      {canReadTasks ? (
        <DashboardSection
          icon="clipboard-plus-outline"
          iconColor={colors.dashboardBlue}
          title="Open tasks"
          count={openTasks.length}
          backgroundColor={colors.dashboardOpenSurface}
          borderColor={colors.dashboardOpenBorder}
        >
          {openTasks.slice(0, 1).map((task) => (
            <OpenTaskCard
              key={task.id}
              busy={taskActionId === task.id}
              task={task}
              onAction={() => onTaskAction(task, "claim")}
            />
          ))}
          {openTasks.length === 0 ? (
            <CompactEmptyState
              icon="clipboard-plus-outline"
              message="No volunteer tasks are currently available."
              title="No open tasks"
            />
          ) : null}
        </DashboardSection>
      ) : null}

      {canReadMeetings ? (
        <DashboardSection
          icon="calendar-clock-outline"
          iconColor={colors.dashboardPurple}
          title="Next meeting"
          backgroundColor={colors.dashboardPurpleSurface}
          borderColor={colors.dashboardPurpleBorder}
        >
          {nextMeeting ? (
            <Pressable
              accessibilityLabel="View meeting"
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/meetings/[id]",
                  params: { id: nextMeeting.id },
                })
              }
              style={({ pressed }) => [
                styles.innerCard,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.innerTitle}>{nextMeeting.title}</Text>
              <Text style={styles.innerMeta}>
                {formatDashboardMeetingRange(
                  nextMeeting.scheduledStart,
                  nextMeeting.scheduledEnd,
                )}
              </Text>
              <Text style={styles.innerMeta}>
                {nextMeeting.location ?? "Location not specified"}
              </Text>
            </Pressable>
          ) : (
            <CompactEmptyState
              icon="calendar-check-outline"
              message="There are no upcoming meetings on your schedule."
              title="No upcoming meetings"
            />
          )}
        </DashboardSection>
      ) : null}

      {canReadNotifications ? (
        <DashboardSection
          icon="bell-outline"
          iconColor={colors.dashboardOrange}
          title="Recent notifications"
          backgroundColor={colors.dashboardYellowSurface}
          borderColor={colors.dashboardYellowBorder}
        >
          <View style={styles.notificationRows}>
            {unreadNotifications.map((notification) => (
              <Pressable
                accessibilityLabel={notification.title}
                accessibilityRole="button"
                key={notification.id}
                onPress={() => onNotificationOpen(notification)}
                style={({ pressed }) => [
                  styles.notificationRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.notificationLeading}>
                  <View style={styles.notificationDotOrange} />

                  <View style={styles.notificationCopy}>
                    <Text numberOfLines={1} style={styles.notificationTitle}>
                      {notification.title}
                    </Text>

                    <Text style={styles.notificationTime}>
                      {notificationOpeningId === notification.id
                        ? "Opening..."
                        : formatRelativeNotificationDate(notification.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.notificationDotBlue} />
              </Pressable>
            ))}
          </View>
          {unreadNotifications.length === 0 ? (
            <CompactEmptyState
              icon="bell-check-outline"
              message="You have reviewed every recent update."
              title="You're all caught up"
            />
          ) : null}
        </DashboardSection>
      ) : null}

      <QuickAccessSection modules={workspaceModules} />

      <OverviewSection
        canReadMeetings={canReadMeetings}
        canReadNotifications={canReadNotifications}
        canReadTasks={canReadTasks}
        meetings={meetings}
        notifications={notifications}
        tasks={tasks}
      />
    </View>
  );
}

function AttentionBanner({ count }: { count: number }) {
  const hasItems = count > 0;

  return (
    <View
      style={[
        styles.attentionBanner,
        hasItems ? styles.attentionBannerActive : styles.attentionBannerClear,
      ]}
    >
      <View
        style={[
          styles.attentionIcon,
          hasItems ? styles.attentionIconActive : styles.attentionIconClear,
        ]}
      >
        <AppIcon
          color={colors.white}
          name={hasItems ? "alert-outline" : "check-circle-outline"}
          size={26}
        />
      </View>

      <View style={styles.attentionCopy}>
        <Text
          style={[
            styles.attentionTitle,
            hasItems ? styles.attentionTitleActive : styles.attentionTitleClear,
          ]}
        >
          {hasItems ? "Needs your attention" : "All caught up"}
        </Text>

        <Text
          style={[
            styles.attentionBody,
            hasItems ? styles.attentionBodyActive : styles.attentionBodyClear,
          ]}
        >
          {hasItems
            ? `${count} item${count === 1 ? "" : "s"} across your work and updates`
            : "Nothing urgent right now"}
        </Text>
      </View>

      {hasItems ? (
        <AppIcon color={colors.dashboardRedMuted} name="chevron-right" size={24} />
      ) : null}
    </View>
  );
}

function DashboardSection({
  backgroundColor,
  borderColor,
  children,
  count,
  icon,
  iconColor,
  title,
}: {
  backgroundColor: string;
  borderColor: string;
  children: React.ReactNode;
  count?: number;
  icon: AppIconName;
  iconColor: string;
  title: string;
}) {
  return (
    <View style={[styles.sectionPanel, { backgroundColor, borderColor }]}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <AppIcon color={iconColor} name={icon} size={22} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        <View style={styles.sectionHeaderRight}>
          {typeof count === "number" ? (
            <View accessibilityLabel={`${title}: ${count}`} accessible style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{count}</Text>
            </View>
          ) : null}

        </View>
      </View>

      {children}
    </View>
  );
}

function CompactEmptyState({
  icon,
  message,
  title,
}: {
  icon: AppIconName;
  message: string;
  title: string;
}) {
  return (
    <View style={styles.compactEmptyCard}>
      <View style={styles.compactEmptyIcon}>
        <AppIcon color={colors.textMuted} name={icon} size={20} />
      </View>
      <View style={styles.compactEmptyCopy}>
        <Text style={styles.compactEmptyTitle}>{title}</Text>
        <Text style={styles.compactEmptyMessage}>{message}</Text>
      </View>
    </View>
  );
}

function AssignedTaskCard({
  busy,
  onAction,
  task,
}: {
  busy: boolean;
  onAction: (action: TaskHomeAction) => void;
  task: CommitteeTaskSummary;
}) {
  const canStart = task.status === "assigned";

  return (
    <View style={styles.innerCard}>
      <Text style={styles.innerTitle}>{task.title}</Text>

      <View style={styles.metaLine}>
        <AppIcon color={colors.textMuted} name="calendar-blank-outline" size={15} />
        <Text style={styles.innerMeta}>{formatTaskDate(task.dueDate)}</Text>

        <AppIcon color={colors.textMuted} name="account-outline" size={15} />
        <Text style={styles.innerMeta}>
          {task.assignmentMode === "direct" ? "Assigned task" : "Task"}
        </Text>
      </View>

      <View style={styles.taskActions}>
        {task.assignmentMode === "direct" && task.status === "assigned" ? (
          <Pressable
            accessibilityLabel="Decline"
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "Decline assignment?",
                "You will be removed from this task and the manager will be notified.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Decline",
                    style: "destructive",
                    onPress: () => onAction("decline"),
                  },
                ],
              )
            }
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryActionText}>Decline</Text>
          </Pressable>
        ) : null}

        {canStart ? (
          <Pressable
            accessibilityLabel={busy ? "Starting" : "Accept & start"}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onAction("start")}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryActionText}>
              {busy ? "Starting..." : "Accept & start"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel="View task"
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/work/[id]",
            params: { id: task.id },
          })
        }
        style={({ pressed }) => [
          styles.taskDetailAction,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.taskDetailActionText}>View task</Text>
        <AppIcon color={colors.primaryActionBlue} name="arrow-right" size={18} />
      </Pressable>
    </View>
  );
}

function OpenTaskCard({
  busy,
  onAction,
  task,
}: {
  busy: boolean;
  onAction: () => void;
  task: CommitteeTaskSummary;
}) {
  return (
    <View style={styles.innerCard}>
      <View style={styles.openTaskRow}>
        <View style={styles.openTaskCopy}>
          <Text style={styles.innerTitle}>{task.title}</Text>

          <View style={styles.metaLine}>
            <AppIcon color={colors.textMuted} name="calendar-blank-outline" size={15} />
            <Text style={styles.innerMeta}>{formatTaskDate(task.dueDate)}</Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel={busy ? "Accepting task" : "Accept task"}
          accessibilityRole="button"
          disabled={busy}
          onPress={onAction}
          style={({ pressed }) => [
            styles.acceptTaskButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.acceptTaskText}>
            {busy ? "Accepting..." : "Accept task"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function QuickAccessSection({
  modules,
}: {
  modules: ReturnType<typeof dashboardWorkspaceModules>;
}) {
  const preferred = ["members", "work", "meetings", "announcements"];

  const ordered = [...modules].sort((a, b) => {
    const ai = preferred.indexOf(a.key);
    const bi = preferred.indexOf(b.key);

    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const shown = ordered.slice(0, 4);

  const tileMeta = {
    members: {
      label: "Members",
      icon: "account-group-outline",
      iconBg: colors.dashboardQuickBlue,
    },
    work: {
      label: "Tasks",
      icon: "clipboard-check-outline",
      iconBg: colors.dashboardQuickGreen,
    },
    meetings: {
      label: "Meetings",
      icon: "calendar-month-outline",
      iconBg: colors.dashboardQuickPurple,
    },
    announcements: {
      label: "Announcements",
      icon: "bullhorn-outline",
      iconBg: colors.dashboardQuickOrange,
    },
  } as const;

  return (
    <DashboardSection
      icon="view-grid-outline"
      iconColor={colors.dashboardGreen}
      title="Quick access"
      backgroundColor={colors.dashboardGreenSurface}
      borderColor={colors.dashboardGreenBorder}
    >
      <View style={styles.quickGrid}>
        {shown.map((module) => {
          const meta =
            tileMeta[module.key as keyof typeof tileMeta] ?? {
              label: module.title,
              icon: "dots-horizontal",
              iconBg: colors.dashboardQuickBlue,
            };

          return (
            <Pressable
              accessibilityLabel={meta.label}
              accessibilityRole="button"
              key={module.key}
              onPress={() => router.push(module.href)}
              style={({ pressed }) => [
                styles.quickTile,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.quickIconCircle,
                  { backgroundColor: meta.iconBg },
                ]}
              >
                <AppIcon color={colors.white} name={meta.icon} size={22} />
              </View>

              <Text numberOfLines={2} style={styles.quickLabel}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </DashboardSection>
  );
}

function OverviewSection({
  canReadMeetings,
  canReadNotifications,
  canReadTasks,
  meetings,
  notifications,
  tasks,
}: {
  canReadMeetings: boolean;
  canReadNotifications: boolean;
  canReadTasks: boolean;
  meetings: UseQueryResult<CommitteeMeetingSummary[], Error>;
  notifications: UseQueryResult<MobileNotification[], Error>;
  tasks: UseQueryResult<CommitteeTaskSummary[], Error>;
}) {
  const activeTasks = activeDashboardTasks(canReadTasks ? (tasks.data ?? []) : []);
  const upcomingMeetings = upcomingDashboardMeetings(
    canReadMeetings ? (meetings.data ?? []) : [],
  );

  const unreadCount = notifications.data?.length ?? 0;

  const metrics = [
    ...(canReadTasks
      ? [{ label: "Open tasks", value: activeTasks.length }]
      : []),
    ...(canReadMeetings
      ? [{ label: "Meetings", value: upcomingMeetings.length }]
      : []),
    ...(canReadNotifications
      ? [{ label: "Unread", value: unreadCount, accent: true }]
      : []),
  ];

  return (
    <DashboardSection
      icon="chart-box-outline"
      iconColor={colors.dashboardBlue}
      title="Overview"
      backgroundColor={colors.dashboardOverviewSurface}
      borderColor={colors.dashboardOverviewBorder}
    >
      <View style={styles.overviewGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.overviewTile}>
            <Text
              style={[
                styles.overviewValue,
                metric.accent && styles.overviewValueAccent,
              ]}
            >
              {metric.value}
            </Text>

            <Text style={styles.overviewLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>
    </DashboardSection>
  );
}

function formatRelativeNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const difference = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(difference / 60000));

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },

  headerLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
  },

  mosqueIcon: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    marginRight: spacing.md,
    width: 54,
  },

  headerCopy: {
    flex: 1,
  },

  headerTitle: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.bold,
    fontSize: 22,
    lineHeight: 27,
  },

  headerSubtitle: {
    color: colors.dashboardMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    marginTop: 1,
  },

  headerBell: {
    marginLeft: spacing.md,
  },

  loadingWrap: {
    marginTop: spacing.lg,
  },

  dashboardStack: {
    gap: 12,
  },

  attentionBanner: {
    alignItems: "center",
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  attentionBannerActive: {
    backgroundColor: colors.dashboardRedSurface,
    borderColor: colors.dashboardRedBorder,
  },

  attentionBannerClear: {
    backgroundColor: colors.dashboardGreenSurface,
    borderColor: colors.dashboardGreenBorder,
  },

  attentionIcon: {
    alignItems: "center",
    borderRadius: 24,
    height: 46,
    justifyContent: "center",
    marginRight: 14,
    width: 46,
  },

  attentionIconActive: {
    backgroundColor: colors.dashboardRed,
  },

  attentionIconClear: {
    backgroundColor: colors.dashboardGreen,
  },

  attentionCopy: {
    flex: 1,
  },

  attentionTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 17,
  },

  attentionTitleActive: {
    color: colors.dashboardRedText,
  },

  attentionTitleClear: {
    color: colors.success,
  },

  attentionBody: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    marginTop: 4,
  },

  attentionBodyActive: {
    color: colors.dashboardRedMuted,
  },

  attentionBodyClear: {
    color: colors.textMuted,
  },

  sectionPanel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },

  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
  },

  sectionTitle: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
  },

  sectionHeaderRight: {
    alignItems: "center",
    flexDirection: "row",
  },

  countBadge: {
    alignItems: "center",
    backgroundColor: "#D9ECFF",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    marginRight: 8,
    minWidth: 30,
    paddingHorizontal: 8,
  },

  countBadgeText: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },

  innerCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
  },

  compactEmptyCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  compactEmptyIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },

  compactEmptyCopy: { flex: 1 },

  compactEmptyTitle: {
    color: colors.textStrong,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 19,
  },

  compactEmptyMessage: {
    color: colors.textMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  innerTitle: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    lineHeight: 21,
  },

  innerMeta: {
    color: colors.dashboardMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  metaLine: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 6,
  },

  taskActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 13,
  },

  secondaryAction: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },

  secondaryActionText: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },

  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.successText,
    borderRadius: radii.control,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },

  primaryActionText: {
    color: colors.white,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },

  taskDetailAction: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 4,
  },

  taskDetailActionText: {
    color: colors.primaryActionBlue,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },

  openTaskRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },

  openTaskCopy: {
    flex: 1,
  },

  acceptTaskButton: {
    alignItems: "center",
    backgroundColor: colors.primaryActionBlue,
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 18,
  },

  acceptTaskText: {
    color: colors.white,
    fontFamily: fontFamilies.bold,
    fontSize: 14,
  },

  notificationRows: {
    gap: 2,
  },

  notificationRow: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 61,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  notificationLeading: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
  },

  notificationDotOrange: {
    backgroundColor: colors.dashboardOrange,
    borderRadius: 6,
    height: 10,
    marginRight: 12,
    width: 10,
  },

  notificationCopy: {
    flex: 1,
  },

  notificationTitle: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },

  notificationTime: {
    color: colors.dashboardMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },

  notificationDotBlue: {
    backgroundColor: colors.dashboardBlue,
    borderRadius: 6,
    height: 9,
    marginLeft: 8,
    width: 9,
  },

  quickGrid: {
    flexDirection: "row",
    gap: 8,
  },

  quickTile: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 104,
    paddingHorizontal: 5,
    paddingVertical: 12,
  },

  quickIconCircle: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 8,
    width: 48,
  },

  quickLabel: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.semibold,
    fontSize: 11,
    lineHeight: 14,
    minHeight: 28,
    textAlign: "center",
  },

  overviewGrid: {
    flexDirection: "row",
    gap: 8,
  },

  overviewTile: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    flex: 1,
    minHeight: 76,
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 9,
  },

  overviewValue: {
    color: colors.dashboardText,
    fontFamily: fontFamilies.bold,
    fontSize: 19,
  },

  overviewValueAccent: {
    color: colors.dashboardOrange,
  },

  overviewLabel: {
    color: colors.dashboardMuted,
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.78,
  },
});
