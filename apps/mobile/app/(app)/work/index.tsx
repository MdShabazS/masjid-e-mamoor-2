import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";

import { useAuth } from "../../../src/auth/AuthProvider";
import {
  AppButton,
  BrandedPageHeader,
  Divider,
  EmptyState,
  ErrorState,
  InformationCard,
  ListRow,
  LoadingState,
  SectionHeader,
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
import { spacing } from "../../../src/theme/tokens";

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
    return <PageState loading copy="Loading committee work..." />;
  }
  if (capabilities.isError) {
    return (
      <PageState
        copy="Committee work access could not be checked."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }
  if (!canRead) {
    return <PageState copy="Committee work is not available for this account." />;
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
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <BrandedPageHeader
        description="Assigned responsibilities, volunteer opportunities, and permanent task history."
        eyebrow="Committee operations"
        title="Work"
      />

      {capabilities.data?.canReadCommitteeMeetings ? (
        <View style={styles.meetingAction}>
          <AppButton
            label="View committee meetings"
            onPress={() => router.push("/work/meetings")}
            variant="secondary"
          />
        </View>
      ) : null}

      {capabilities.data?.canAssignCommitteeTasks ? (
        <View style={styles.primaryAction}>
          <AppButton label="Create task" onPress={() => router.push("/work/create")} />
        </View>
      ) : null}

      {state === "loading" ? <LoadingState label="Loading tasks" /> : null}
      {state === "error" ? (
        <ErrorState
          action={
            <AppButton label="Retry" onPress={() => void tasks.refetch()} variant="secondary" />
          }
          description="Tasks could not load. Check your connection and try again."
          title="Work unavailable"
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
            description="Active responsibilities assigned to you"
            emptyCopy="No active tasks are assigned to you."
            tasks={groups.assigned}
            title="My tasks"
          />
          {groups.open.length > 0 ? (
            <TaskGroup
              description="Available tasks that an eligible volunteer may claim"
              tasks={groups.open}
              title="Open volunteer tasks"
            />
          ) : null}
          {groups.team.length > 0 ? (
            <TaskGroup
              description="Other active work visible within your authorized scope"
              tasks={groups.team}
              title="Team tasks"
            />
          ) : null}
          {groups.completed.length > 0 ? (
            <TaskGroup
              description="Completed work retained as permanent history"
              tasks={groups.completed}
              title="Completed"
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function TaskGroup({
  description,
  emptyCopy,
  tasks,
  title,
}: {
  description: string;
  emptyCopy?: string;
  tasks: CommitteeTaskSummary[];
  title: string;
}) {
  return (
    <View style={styles.group}>
      <SectionHeader description={description} title={`${title} · ${tasks.length}`} />
      {tasks.length === 0 ? (
        <InformationCard>
          <ListRow subtitle={emptyCopy ?? "No tasks in this section."} title="Nothing pending" />
        </InformationCard>
      ) : (
        <InformationCard style={styles.listCard}>
          {tasks.map((task, index) => {
            const source = taskSourceContext(task);
            const assignment =
              task.assignmentMode === "open" && task.status === "open"
                ? "Open volunteer task"
                : `${task.assigneeIds.length} ${task.assigneeIds.length === 1 ? "assignee" : "assignees"}`;

            return (
              <View key={task.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  meta={`${source ? `${source} · ` : ""}Due: ${formatTaskDate(task.dueDate)} · ${assignment}`}
                  onPress={() =>
                    router.push({
                      pathname: "/work/[id]",
                      params: { id: task.id },
                    })
                  }
                  subtitle={`${taskPriorityLabels[task.priority]} priority · ${taskStatusLabels[task.status]}`}
                  title={task.title}
                  trailing={
                    <StatusChip
                      label={task.isOverdue ? "Overdue" : taskStatusLabels[task.status]}
                      tone={
                        task.isOverdue
                          ? "warning"
                          : task.status === "completed"
                            ? "success"
                            : task.status === "open"
                              ? "info"
                              : "neutral"
                      }
                    />
                  }
                />
              </View>
            );
          })}
        </InformationCard>
      )}
    </View>
  );
}

function PageState({
  copy,
  loading = false,
  onRetry,
}: {
  copy: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Screen contentContainerStyle={styles.pageState}>
      {loading ? <LoadingState label={copy} /> : null}
      {!loading && onRetry ? (
        <ErrorState
          action={<AppButton label="Retry" onPress={onRetry} variant="secondary" />}
          description={copy}
          title="Work unavailable"
        />
      ) : null}
      {!loading && !onRetry ? <EmptyState description={copy} title="Work unavailable" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  primaryAction: { marginTop: spacing.xl },
  meetingAction: { marginTop: spacing.lg },
  groups: { gap: spacing.section, marginTop: spacing.section },
  group: { gap: spacing.md },
  listCard: { paddingBottom: 0, paddingTop: 0 },
  pageState: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
});
