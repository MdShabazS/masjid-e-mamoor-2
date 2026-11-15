import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { useAuth } from "../../../src/auth/AuthProvider";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import { AppText as Text } from "../../../src/components/AppText";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusChip,
} from "../../../src/components/InstitutionalUI";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  committeeTaskListQueryKey,
  listCommitteeTasks,
  type CommitteeTaskSummary,
} from "../../../src/modules/work";
import {
  formatTaskDate,
  groupWorkTasks,
  taskPriorityLabels,
  taskSourceContext,
  taskStatusLabels,
  workListState,
} from "../../../src/modules/work-presentation";
import { colors } from "../../../src/theme/colors";
import { fontFamilies, radii, spacing } from "../../../src/theme/tokens";

export default function WorkScreen() {
  const { account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canRead = capabilities.data?.canReadCommitteeTasks === true;
  const tasks = useQuery({
    queryKey: committeeTaskListQueryKey(account?.id),
    queryFn: listCommitteeTasks,
    enabled: canRead,
  });

  if (!account || capabilities.isLoading) {
    return <PageState loading copy="Loading committee tasks..." />;
  }
  if (capabilities.isError) {
    return (
      <PageState
        copy="Task access could not be checked."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }
  if (!canRead) {
    return <PageState copy="Tasks are not available for this account." />;
  }

  const items = tasks.data ?? [];
  const state = workListState({
    loading: tasks.isLoading,
    error: tasks.isError,
    count: items.length,
  });
  const groups = groupWorkTasks(items, account.id);

  return (
    <Screen
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={tasks.isRefetching}
            onRefresh={() => void tasks.refetch()}
            tintColor={colors.primaryBlue}
          />
        ),
      }}
    >
      <BrandedPageHeader
        description="Manage assigned and open committee tasks."
        title="Tasks"
      />

      <View style={styles.actions}>
        {capabilities.data?.canAssignCommitteeTasks ? (
          <AppButton
            icon={<AppIcon color={colors.white} name="plus" size={18} />}
            label="Create task"
            onPress={() => router.push("/work/create")}
          />
        ) : null}
      </View>

      {state === "loading" ? <LoadingState label="Loading tasks" /> : null}
      {state === "error" ? (
        <ErrorState
          action={
            <AppButton label="Retry" onPress={() => void tasks.refetch()} variant="secondary" />
          }
          description="Tasks could not load. Check your connection and try again."
          title="Tasks unavailable"
        />
      ) : null}
      {state === "empty" ? (
        <EmptyState
          description="No committee tasks are currently available to this account."
          title="No work available"
        />
      ) : null}

      {state === "ready" ? (
        <View style={styles.groups}>
          <TaskGroup
            emptyCopy="No active tasks are assigned to you."
            icon="clipboard-check-outline"
            tasks={groups.assigned}
            title="My tasks"
            tone="blue"
          />
          {groups.open.length > 0 ? (
            <TaskGroup icon="clipboard-plus-outline" tasks={groups.open} title="Open tasks" tone="green" />
          ) : null}
          {groups.team.length > 0 ? (
            <TaskGroup icon="account-group-outline" tasks={groups.team} title="Team tasks" tone="purple" />
          ) : null}
          {groups.completed.length > 0 ? (
            <TaskGroup icon="check-circle-outline" tasks={groups.completed} title="Completed" tone="neutral" />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const groupTones = {
  blue: { background: colors.blueSurface, border: "#D8E8FA", icon: colors.primaryBlue },
  green: { background: colors.greenSurface, border: "#D0F0E2", icon: colors.successGreen },
  purple: { background: colors.purpleSurface, border: "#E5D8FB", icon: colors.purple },
  neutral: { background: colors.surfaceMuted, border: colors.border, icon: colors.textMuted },
} as const;

function TaskGroup({ emptyCopy, icon, tasks, title, tone }: {
  emptyCopy?: string;
  icon: AppIconName;
  tasks: CommitteeTaskSummary[];
  title: string;
  tone: keyof typeof groupTones;
}) {
  const palette = groupTones[tone];

  return (
    <View style={[styles.group, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          <AppIcon color={palette.icon} name={icon} size={21} />
          <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{tasks.length}</Text>
        </View>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.compactEmpty}>
          <Text style={styles.emptyTitle}>Nothing pending</Text>
          <Text style={styles.emptyCopy}>{emptyCopy ?? "No tasks in this section."}</Text>
        </View>
      ) : (
        <View style={styles.cards}>
          {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
        </View>
      )}
    </View>
  );
}

function TaskCard({ task }: { task: CommitteeTaskSummary }) {
  const source = taskSourceContext(task);
  const assignment =
    task.assignmentMode === "open" && task.status === "open"
      ? "Open volunteer task"
      : `${task.assigneeIds.length} ${task.assigneeIds.length === 1 ? "assignee" : "assignees"}`;

  return (
    <Pressable
      accessibilityLabel={`View task: ${task.title}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/work/[id]", params: { id: task.id } })}
      style={({ pressed }) => [styles.taskCard, pressed && styles.pressed]}
    >
      <View style={styles.taskTopRow}>
        <Text numberOfLines={2} style={styles.taskTitle}>{task.title}</Text>
        <AppIcon color={colors.textMuted} name="chevron-right" size={21} />
      </View>
      <View style={styles.metaRow}>
        <AppIcon color={colors.textMuted} name="calendar-blank-outline" size={15} />
        <Text style={styles.metaText}>Due {formatTaskDate(task.dueDate)}</Text>
      </View>
      <Text numberOfLines={2} style={styles.contextText}>
        {source ? `${source} · ` : ""}{assignment}
      </Text>
      <View style={styles.chips}>
        <StatusChip
          label={task.isOverdue ? "Overdue" : taskStatusLabels[task.status]}
          tone={task.isOverdue ? "warning" : task.status === "completed" ? "success" : task.status === "open" ? "info" : "neutral"}
        />
        <Text style={styles.priorityText}>{taskPriorityLabels[task.priority]} priority</Text>
      </View>
    </Pressable>
  );
}

function PageState({ copy, loading = false, onRetry }: { copy: string; loading?: boolean; onRetry?: () => void }) {
  return (
    <Screen contentContainerStyle={styles.pageState}>
      {loading ? <LoadingState label={copy} /> : null}
      {!loading && onRetry ? (
        <ErrorState
          action={<AppButton label="Retry" onPress={onRetry} variant="secondary" />}
          description={copy}
          title="Tasks unavailable"
        />
      ) : null}
      {!loading && !onRetry ? <EmptyState description={copy} title="Tasks unavailable" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  groups: { gap: spacing.lg, marginTop: spacing.xl },
  group: { borderRadius: radii.card, borderWidth: 1, padding: spacing.md },
  groupHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  groupTitleRow: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  groupTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 22 },
  countBadge: { alignItems: "center", backgroundColor: colors.white, borderRadius: 999, justifyContent: "center", minHeight: 28, minWidth: 28, paddingHorizontal: 8 },
  countText: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 13 },
  cards: { gap: spacing.sm },
  taskCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, minHeight: 44, padding: spacing.md },
  taskTopRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  taskTitle: { color: colors.textStrong, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: spacing.sm },
  metaText: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17 },
  contextText: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  priorityText: { color: colors.textMuted, fontFamily: fontFamilies.medium, fontSize: 12 },
  compactEmpty: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, padding: spacing.md },
  emptyTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 14 },
  emptyCopy: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  pressed: { opacity: 0.72 },
  pageState: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
