import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../src/auth/AuthProvider";
import {
  AppButton,
  BrandedPageHeader,
  Divider,
  ErrorState,
  InformationCard,
  ListRow,
  LoadingState,
  MetricCard,
  SectionHeader,
  StatusChip,
} from "../../src/components/InstitutionalUI";
import { NotificationBell } from "../../src/components/NotificationBell";
import { Screen } from "../../src/components/Screen";
import { loadCapabilities, type MobileCapabilities } from "../../src/modules/capabilities";
import {
  activeDashboardTasks,
  dashboardWorkspaceModules,
  formatDashboardMeetingDate,
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
  listCommitteeTasks,
  startCommitteeTask,
  type CommitteeTaskSummary,
} from "../../src/modules/work";
import {
  formatTaskDate,
  taskPriorityLabels,
  taskStatusLabels,
} from "../../src/modules/work-presentation";
import { colors, roleLabels } from "../../src/theme/colors";
import { radii, spacing, typography } from "../../src/theme/tokens";

type TaskHomeAction = "claim" | "start";

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
    enabled: Boolean(account),
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

      return startCommitteeTask(task.id, operationId);
    },

    onSuccess: async (updatedTask) => {
      if (account) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: committeeTaskListQueryKey(account.id),
          }),
          ...notificationInvalidationKeys(account.id).map((queryKey) =>
            queryClient.invalidateQueries({
              queryKey,
            }),
          ),
        ]);
      }

      router.push({
        pathname: "/work/[id]",
        params: {
          id: updatedTask.id,
        },
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
            queryClient.invalidateQueries({
              queryKey,
            }),
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

  const accountName = account.memberProfile?.displayName || account.username || "Account";

  const refreshAll = async () => {
    await capabilities.refetch();
    await notifications.refetch();

    if (canReadTasks) {
      await tasks.refetch();
    }

    if (canReadMeetings) {
      await meetings.refetch();
    }
  };

  const refreshing =
    capabilities.isRefetching ||
    notifications.isRefetching ||
    tasks.isRefetching ||
    meetings.isRefetching;

  return (
    <Screen
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refreshAll();
            }}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <StatusBar style="dark" />

      <BrandedPageHeader
        action={<NotificationBell />}
        description="What needs your attention, followed by the tools available to your role."
        eyebrow="Masjid E Mamoor 2"
        title="Home"
      />

      <View style={styles.welcomePanel}>
        <View style={styles.welcomeAccent} />

        <Text style={styles.greeting}>Assalamu Alaikum</Text>

        <Text style={styles.accountName}>{accountName}</Text>

        <View style={styles.roleContext}>
          <Text style={styles.roleLabel}>{roleLabels[account.role]}</Text>

          <Text style={styles.roleSeparator}>•</Text>

          <Text style={styles.accountStatus}>Active account</Text>
        </View>
      </View>

      {capabilities.isLoading ? (
        <View style={styles.section}>
          <LoadingState label="Preparing your dashboard" />
        </View>
      ) : null}

      {capabilities.isError ? (
        <View style={styles.section}>
          <ErrorState
            action={
              <AppButton
                label="Retry"
                onPress={() => void capabilities.refetch()}
                variant="secondary"
              />
            }
            description="Your authorized workspace could not be loaded. Check your connection and try again."
            title="Workspace unavailable"
          />
        </View>
      ) : null}

      {capabilities.data ? (
        <>
          <AttentionSection
            accountId={account.id}
            canReadMeetings={canReadMeetings}
            canReadTasks={canReadTasks}
            meetings={meetings}
            notifications={notifications}
            onNotificationOpen={(notification) => openNotification.mutate(notification)}
            onTaskAction={(task, action) =>
              taskAction.mutate({
                action,
                task,
              })
            }
            notificationOpeningId={
              openNotification.isPending ? openNotification.variables?.id : undefined
            }
            taskActionId={taskAction.isPending ? taskAction.variables?.task.id : undefined}
            tasks={tasks}
          />

          <WorkspaceSection capabilities={capabilities.data} />

          <DashboardOverview
            canReadMeetings={canReadMeetings}
            canReadTasks={canReadTasks}
            meetings={meetings}
            notifications={notifications}
            tasks={tasks}
          />
        </>
      ) : null}
    </Screen>
  );
}

function AttentionSection({
  accountId,
  canReadMeetings,
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
  canReadMeetings: boolean;
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

  const myTasks = activeTasks.filter((task) => task.assigneeIds.includes(accountId)).slice(0, 2);

  const openTask = activeTasks.find(
    (task) => task.assignmentMode === "open" && task.status === "open",
  );

  const nextMeeting = upcomingDashboardMeetings(canReadMeetings ? (meetings.data ?? []) : [])[0];

  const unreadNotifications = (notifications.data ?? []).slice(0, 2);

  const loading =
    notifications.isLoading ||
    (canReadTasks && tasks.isLoading) ||
    (canReadMeetings && meetings.isLoading);

  const hasAttention =
    myTasks.length > 0 ||
    Boolean(openTask) ||
    Boolean(nextMeeting) ||
    unreadNotifications.length > 0;

  return (
    <View style={styles.section}>
      <SectionHeader
        description="Important items are placed here first so nothing gets missed."
        title="Needs your attention"
      />

      {loading && !hasAttention ? (
        <LoadingState label="Checking tasks, meetings and notifications" />
      ) : null}

      {!loading && !hasAttention ? (
        <InformationCard>
          <View style={styles.clearState}>
            <StatusChip label="All caught up" tone="success" />

            <Text style={styles.clearTitle}>Nothing urgent right now</Text>

            <Text style={styles.clearDescription}>
              New task assignments, meeting updates and important notifications will appear here.
            </Text>
          </View>
        </InformationCard>
      ) : null}

      {myTasks.map((task) => (
        <TaskAttentionCard
          key={task.id}
          busy={taskActionId === task.id}
          onAction={(action) => onTaskAction(task, action)}
          task={task}
          type="assigned"
        />
      ))}

      {openTask ? (
        <TaskAttentionCard
          busy={taskActionId === openTask.id}
          onAction={(action) => onTaskAction(openTask, action)}
          task={openTask}
          type="open"
        />
      ) : null}

      {nextMeeting ? <MeetingAttentionCard meeting={nextMeeting} /> : null}

      {unreadNotifications.length > 0 ? (
        <InformationCard emphasis style={styles.attentionCard}>
          <View style={styles.attentionHeading}>
            <View>
              <Text style={styles.attentionEyebrow}>NEW NOTIFICATIONS</Text>

              <Text style={styles.attentionTitle}>Recent updates</Text>
            </View>

            <StatusChip label={`${unreadNotifications.length} new`} tone="info" />
          </View>

          <View style={styles.notificationList}>
            {unreadNotifications.map((notification, index) => (
              <View key={notification.id}>
                {index > 0 ? <Divider /> : null}

                <ListRow
                  meta={formatHomeNotificationDate(notification.createdAt)}
                  onPress={() => onNotificationOpen(notification)}
                  subtitle={notification.body}
                  title={notification.title}
                  trailing={
                    notificationOpeningId === notification.id ? (
                      <StatusChip label="Opening" tone="info" />
                    ) : (
                      <StatusChip label="New" tone="info" />
                    )
                  }
                />
              </View>
            ))}
          </View>

          <View style={styles.singleAction}>
            <AppButton
              label="View all notifications"
              onPress={() => router.push("/notifications")}
              variant="secondary"
            />
          </View>
        </InformationCard>
      ) : null}
    </View>
  );
}

function TaskAttentionCard({
  busy,
  onAction,
  task,
  type,
}: {
  busy: boolean;
  onAction: (action: TaskHomeAction) => void;
  task: CommitteeTaskSummary;
  type: "assigned" | "open";
}) {
  const isOpen = type === "open";

  const canStart = !isOpen && task.status === "assigned";

  const primaryLabel = isOpen ? "Accept task" : canStart ? "Accept & start" : null;

  const primaryAction: TaskHomeAction | null = isOpen ? "claim" : canStart ? "start" : null;

  return (
    <InformationCard emphasis style={styles.attentionCard}>
      <View style={styles.attentionHeading}>
        <View style={styles.attentionCopy}>
          <Text style={styles.attentionEyebrow}>{isOpen ? "AVAILABLE TASK" : "YOUR TASK"}</Text>

          <Text style={styles.attentionTitle}>{task.title}</Text>
        </View>

        <StatusChip
          label={task.isOverdue ? "Overdue" : taskPriorityLabels[task.priority]}
          tone={task.isOverdue ? "warning" : task.priority === "high" ? "warning" : "info"}
        />
      </View>

      {task.description ? (
        <Text numberOfLines={3} style={styles.attentionDescription}>
          {task.description}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Due: {formatTaskDate(task.dueDate)}</Text>

        <Text style={styles.metaDot}>•</Text>

        <Text style={styles.metaText}>
          {isOpen ? "Open volunteer task" : taskStatusLabels[task.status]}
        </Text>
      </View>

      <View style={styles.actionRow}>
        {primaryLabel && primaryAction ? (
          <View style={styles.actionButton}>
            <AppButton
              label={primaryLabel}
              loading={busy}
              onPress={() => onAction(primaryAction)}
            />
          </View>
        ) : null}

        <View style={styles.actionButton}>
          <AppButton
            label="View task"
            onPress={() =>
              router.push({
                pathname: "/work/[id]",
                params: {
                  id: task.id,
                },
              })
            }
            variant={primaryLabel ? "secondary" : "primary"}
          />
        </View>
      </View>
    </InformationCard>
  );
}

function MeetingAttentionCard({ meeting }: { meeting: CommitteeMeetingSummary }) {
  return (
    <InformationCard emphasis style={styles.attentionCard}>
      <View style={styles.attentionHeading}>
        <View style={styles.attentionCopy}>
          <Text style={styles.attentionEyebrow}>NEXT MEETING</Text>

          <Text style={styles.attentionTitle}>{meeting.title}</Text>
        </View>

        <StatusChip label="Scheduled" tone="success" />
      </View>

      <Text style={styles.meetingDate}>{formatDashboardMeetingDate(meeting.scheduledStart)}</Text>

      <Text style={styles.attentionDescription}>
        {meeting.location ?? "Location not specified"}
      </Text>

      <View style={styles.singleAction}>
        <AppButton
          label="View meeting"
          onPress={() =>
            router.push({
              pathname: "/work/meetings/[id]",
              params: {
                id: meeting.id,
              },
            })
          }
        />
      </View>
    </InformationCard>
  );
}

function WorkspaceSection({ capabilities }: { capabilities: MobileCapabilities }) {
  const modules = dashboardWorkspaceModules(capabilities);

  return (
    <View style={styles.section}>
      <SectionHeader
        description="Only the tools available to your role are shown."
        title="Quick access"
      />

      <InformationCard style={styles.workspaceCard}>
        {modules.map((module, index) => (
          <View key={module.key}>
            {index > 0 ? <Divider /> : null}

            <ListRow
              onPress={() => router.push(module.href)}
              subtitle={module.description}
              title={module.title}
            />
          </View>
        ))}
      </InformationCard>
    </View>
  );
}

function DashboardOverview({
  canReadMeetings,
  canReadTasks,
  meetings,
  notifications,
  tasks,
}: {
  canReadMeetings: boolean;
  canReadTasks: boolean;
  meetings: UseQueryResult<CommitteeMeetingSummary[], Error>;
  notifications: UseQueryResult<MobileNotification[], Error>;
  tasks: UseQueryResult<CommitteeTaskSummary[], Error>;
}) {
  const activeTasks = activeDashboardTasks(canReadTasks ? (tasks.data ?? []) : []);

  const upcomingMeetings = upcomingDashboardMeetings(canReadMeetings ? (meetings.data ?? []) : []);

  const unreadCount = notifications.data?.length ?? 0;

  return (
    <View style={styles.section}>
      <SectionHeader
        description="A quick summary without making the home page busy."
        title="Overview"
      />

      <View style={styles.metricsRow}>
        {canReadTasks ? (
          <MetricCard
            helper="Visible active work"
            label="Tasks"
            style={styles.metricCard}
            tone={activeTasks.some((task) => task.isOverdue) ? "warning" : "neutral"}
            value={activeTasks.length}
          />
        ) : null}

        {canReadMeetings ? (
          <MetricCard
            helper="Scheduled ahead"
            label="Meetings"
            style={styles.metricCard}
            value={upcomingMeetings.length}
          />
        ) : null}

        <MetricCard
          helper="Unread updates"
          label="Notifications"
          style={styles.metricCard}
          tone={unreadCount > 0 ? "info" : "neutral"}
          value={unreadCount}
        />
      </View>

      <View style={styles.overviewActions}>
        {canReadTasks ? (
          <View style={styles.overviewButton}>
            <AppButton label="All work" onPress={() => router.push("/work")} variant="secondary" />
          </View>
        ) : null}

        {canReadMeetings ? (
          <View style={styles.overviewButton}>
            <AppButton
              label="Meetings"
              onPress={() => router.push("/work/meetings")}
              variant="secondary"
            />
          </View>
        ) : null}

        <View style={styles.overviewButton}>
          <AppButton
            label="Notifications"
            onPress={() => router.push("/notifications")}
            variant="secondary"
          />
        </View>
      </View>
    </View>
  );
}

function formatHomeNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },

  welcomePanel: {
    backgroundColor: colors.darkEmerald,
    borderRadius: radii.card,
    marginTop: spacing.xxl,
    overflow: "hidden",
    padding: spacing.xl,
    position: "relative",
  },

  welcomeAccent: {
    backgroundColor: colors.gold,
    height: 3,
    left: spacing.xl,
    position: "absolute",
    top: 0,
    width: 52,
  },

  greeting: {
    color: colors.goldMuted,
    ...typography.label,
  },

  accountName: {
    color: colors.surface,
    marginTop: spacing.sm,
    ...typography.pageTitle,
  },

  roleContext: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  roleLabel: {
    color: colors.surface,
    ...typography.bodySmall,
  },

  roleSeparator: {
    color: colors.gold,
    ...typography.bodySmall,
  },

  accountStatus: {
    color: colors.goldMuted,
    ...typography.bodySmall,
  },

  section: {
    gap: spacing.lg,
    marginTop: spacing.section,
  },

  attentionCard: {
    gap: spacing.md,
  },

  attentionHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },

  attentionCopy: {
    flex: 1,
  },

  attentionEyebrow: {
    color: colors.gold,
    ...typography.eyebrow,
  },

  attentionTitle: {
    color: colors.textStrong,
    marginTop: spacing.xs,
    ...typography.sectionTitle,
  },

  attentionDescription: {
    color: colors.secondary,
    ...typography.body,
  },

  meetingDate: {
    color: colors.deepEmerald,
    ...typography.cardTitle,
  },

  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  metaText: {
    color: colors.textMuted,
    ...typography.caption,
  },

  metaDot: {
    color: colors.gold,
    ...typography.caption,
  },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  actionButton: {
    flexGrow: 1,
    minWidth: 130,
  },

  singleAction: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },

  clearState: {
    gap: spacing.sm,
  },

  clearTitle: {
    color: colors.textStrong,
    ...typography.cardTitle,
  },

  clearDescription: {
    color: colors.secondary,
    ...typography.bodySmall,
  },

  notificationList: {
    marginTop: spacing.xs,
  },

  workspaceCard: {
    paddingBottom: 0,
    paddingTop: 0,
  },

  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },

  metricCard: {
    flexBasis: 145,
    flexGrow: 1,
  },

  overviewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  overviewButton: {
    flexGrow: 1,
    minWidth: 120,
  },
});
