import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../src/auth/AuthProvider";
import {
  AppButton,
  BrandedPageHeader,
  Divider,
  EmptyState,
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
  committeeTaskListQueryKey,
  listCommitteeTasks,
  type CommitteeTaskSummary,
} from "../../src/modules/work";
import { formatTaskDate, taskStatusLabels } from "../../src/modules/work-presentation";
import { colors, roleLabels } from "../../src/theme/colors";
import { radii, spacing, typography } from "../../src/theme/tokens";

export default function HomeScreen() {
  const { account } = useAuth();
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

  if (!account) return null;

  const accountName = account.memberProfile?.displayName || account.username || "Account";

  return (
    <Screen contentContainerStyle={styles.content} scroll>
      <StatusBar style="dark" />
      <BrandedPageHeader
        action={<NotificationBell />}
        description="A clear view of your authorized Masjid operations."
        eyebrow="Masjid E Mamoor 2"
        title="Management overview"
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
          <LoadingState label="Preparing your workspace" />
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
          <WorkspaceSection capabilities={capabilities.data} />
          {canReadTasks || canReadMeetings ? (
            <CommitteeOverview
              canReadMeetings={canReadMeetings}
              canReadTasks={canReadTasks}
              meetings={meetings}
              tasks={tasks}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function WorkspaceSection({ capabilities }: { capabilities: MobileCapabilities }) {
  const modules = dashboardWorkspaceModules(capabilities);

  return (
    <View style={styles.section}>
      <SectionHeader description="Tools available to this account" title="Your workspace" />
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

function CommitteeOverview({
  canReadMeetings,
  canReadTasks,
  meetings,
  tasks,
}: {
  canReadMeetings: boolean;
  canReadTasks: boolean;
  meetings: UseQueryResult<CommitteeMeetingSummary[], Error>;
  tasks: UseQueryResult<CommitteeTaskSummary[], Error>;
}) {
  const activeTasks = activeDashboardTasks(canReadTasks ? (tasks.data ?? []) : []);
  const upcomingMeetings = upcomingDashboardMeetings(canReadMeetings ? (meetings.data ?? []) : []);
  const loading = (canReadTasks && tasks.isLoading) || (canReadMeetings && meetings.isLoading);
  const failed = (canReadTasks && tasks.isError) || (canReadMeetings && meetings.isError);

  return (
    <View style={styles.section}>
      <SectionHeader
        description="Authorized committee activity requiring attention"
        title="Committee overview"
      />

      {loading ? <LoadingState label="Loading committee overview" /> : null}

      {failed && !loading ? (
        <ErrorState
          action={
            <AppButton
              label="Retry"
              onPress={() => {
                if (canReadTasks) void tasks.refetch();
                if (canReadMeetings) void meetings.refetch();
              }}
              variant="secondary"
            />
          }
          description="Committee activity could not be refreshed. Your workspace links remain available."
          title="Committee overview unavailable"
        />
      ) : null}

      {!loading && !failed ? (
        <>
          <View style={styles.metricsRow}>
            {canReadTasks ? (
              <MetricCard
                helper="Visible to this account"
                label="Active work"
                style={styles.metricCard}
                tone={activeTasks.some((task) => task.isOverdue) ? "warning" : "neutral"}
                value={activeTasks.length}
              />
            ) : null}
            {canReadMeetings ? (
              <MetricCard
                helper="Scheduled ahead"
                label="Upcoming meetings"
                style={styles.metricCard}
                value={upcomingMeetings.length}
              />
            ) : null}
          </View>

          {activeTasks.length === 0 && upcomingMeetings.length === 0 ? (
            <EmptyState
              description="No active committee work or upcoming meetings are currently visible to this account."
              title="Nothing pending"
            />
          ) : null}

          {activeTasks.length > 0 ? (
            <View style={styles.previewSection}>
              <SectionHeader
                description="Highest-priority items from your authorized task list"
                title="Active work"
              />
              <InformationCard style={styles.previewCard}>
                {activeTasks.slice(0, 3).map((task, index) => (
                  <View key={task.id}>
                    {index > 0 ? <Divider /> : null}
                    <ListRow
                      meta={`Due: ${formatTaskDate(task.dueDate)}`}
                      onPress={() =>
                        router.push({
                          pathname: "/work/[id]",
                          params: { id: task.id },
                        })
                      }
                      subtitle={task.isOverdue ? "Overdue" : taskStatusLabels[task.status]}
                      title={task.title}
                      trailing={
                        <StatusChip
                          label={task.isOverdue ? "Overdue" : taskStatusLabels[task.status]}
                          tone={task.isOverdue ? "warning" : "info"}
                        />
                      }
                    />
                  </View>
                ))}
              </InformationCard>
            </View>
          ) : null}

          {upcomingMeetings.length > 0 ? (
            <View style={styles.previewSection}>
              <SectionHeader
                description="The next scheduled meetings visible to this account"
                title="Upcoming meetings"
              />
              <InformationCard style={styles.previewCard}>
                {upcomingMeetings.slice(0, 2).map((meeting, index) => (
                  <View key={meeting.id}>
                    {index > 0 ? <Divider /> : null}
                    <ListRow
                      meta={meeting.location ?? "Location not specified"}
                      onPress={() =>
                        router.push({
                          pathname: "/work/meetings/[id]",
                          params: { id: meeting.id },
                        })
                      }
                      subtitle={formatDashboardMeetingDate(meeting.scheduledStart)}
                      title={meeting.title}
                      trailing={<StatusChip label="Scheduled" tone="success" />}
                    />
                  </View>
                ))}
              </InformationCard>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
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
    flexBasis: 150,
    flexGrow: 1,
  },
  previewSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  previewCard: {
    paddingBottom: 0,
    paddingTop: 0,
  },
});
