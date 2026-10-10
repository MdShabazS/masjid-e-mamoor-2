import { useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
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
} from "../../../../src/components/InstitutionalUI";
import { FormTextInput, Screen } from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  addCommitteeTaskProgress,
  claimOpenCommitteeTask,
  committeeTaskDetailQueryKey,
  committeeTaskListQueryKey,
  completeCommitteeTask,
  createCommitteeOperationId,
  getCommitteeTask,
  startCommitteeTask,
} from "../../../../src/modules/work";
import {
  formatTaskDate,
  taskActionVisibility,
  taskErrorMessage,
  taskPriorityLabels,
  taskSourceContext,
  taskStatusLabels,
} from "../../../../src/modules/work-presentation";
import { colors } from "../../../../src/theme/colors";
import { borders, radii, spacing, typography } from "../../../../src/theme/tokens";

export default function CommitteeTaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [progressRemark, setProgressRemark] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canRead = capabilities.data?.canReadCommitteeTasks === true;
  const task = useQuery({
    queryKey: committeeTaskDetailQueryKey(taskId),
    queryFn: () => getCommitteeTask(taskId),
    enabled: Boolean(account && taskId && canRead),
  });

  const refreshTaskData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: committeeTaskDetailQueryKey(taskId),
      }),
      queryClient.invalidateQueries({
        queryKey: committeeTaskListQueryKey(account?.id),
      }),
    ]);
  };

  const progress = useMutation({
    mutationFn: ({ remark, operationId }: { remark: string; operationId: string }) =>
      addCommitteeTaskProgress(taskId, remark, operationId),
    onSuccess: async () => {
      setProgressRemark("");
      await refreshTaskData();
    },
    onError: (error) => {
      Alert.alert("Progress could not be added", taskErrorMessage(error));
    },
  });
  const claim = useMutation({
    mutationFn: (operationId: string) => claimOpenCommitteeTask(taskId, operationId),
    onSuccess: refreshTaskData,
    onError: (error) => {
      Alert.alert("Task could not be claimed", taskErrorMessage(error));
    },
  });
  const start = useMutation({
    mutationFn: (operationId: string) => startCommitteeTask(taskId, operationId),
    onSuccess: refreshTaskData,
    onError: (error) => {
      Alert.alert("Task could not be started", taskErrorMessage(error));
    },
  });
  const complete = useMutation({
    mutationFn: ({ notes, operationId }: { notes: string; operationId: string }) =>
      completeCommitteeTask(taskId, notes, operationId),
    onSuccess: async () => {
      setCompletionNotes("");
      await refreshTaskData();
    },
    onError: (error) => {
      Alert.alert("Task could not be completed", taskErrorMessage(error));
    },
  });

  if (!account || capabilities.isLoading) {
    return <PageState loading copy="Loading committee task..." />;
  }
  if (capabilities.isError) {
    return (
      <PageState
        copy="Committee task access could not be checked."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }
  if (!canRead) {
    return <PageState copy="This committee task is not available for your account." />;
  }
  if (task.isLoading) return <PageState loading copy="Loading task..." />;
  if (task.isError || !task.data) {
    return (
      <PageState
        copy="This task is unavailable or outside your authorized scope."
        onRetry={() => void task.refetch()}
      />
    );
  }

  const actions = taskActionVisibility({
    accountId: account.id,
    capabilities: {
      canManageCommitteeTasks: capabilities.data?.canManageCommitteeTasks === true,
      canAssignCommitteeTasks: capabilities.data?.canAssignCommitteeTasks === true,
    },
    task: task.data,
  });
  const activeAssignees = task.data.assignees.filter((assignee) => assignee.removedAt === null);
  const sourceContext = taskSourceContext(task.data);
  const mutationPending =
    progress.isPending || claim.isPending || start.isPending || complete.isPending;

  const addProgress = () => {
    const remark = progressRemark.trim();
    if (!remark) {
      Alert.alert("Progress note required", "Enter a progress update first.");
      return;
    }
    if (mutationPending) return;
    progress.mutate({ remark, operationId: createCommitteeOperationId() });
  };
  const confirmClaim = () => {
    if (mutationPending) return;
    Alert.alert("Claim volunteer task?", "You will become the active assignee for this task.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Claim task",
        onPress: () => claim.mutate(createCommitteeOperationId()),
      },
    ]);
  };
  const confirmStart = () => {
    if (mutationPending) return;
    Alert.alert("Start task?", "The task status will change to In progress.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start task",
        onPress: () => start.mutate(createCommitteeOperationId()),
      },
    ]);
  };
  const confirmComplete = () => {
    if (mutationPending) return;
    Alert.alert(
      "Complete task?",
      "The task will be marked completed and can no longer be edited.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete task",
          onPress: () =>
            complete.mutate({
              notes: completionNotes,
              operationId: createCommitteeOperationId(),
            }),
        },
      ],
    );
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={task.isRefetching}
            onRefresh={() => void task.refetch()}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <BrandedPageHeader
        description="Authoritative task details and progress history"
        eyebrow="Committee task"
        title={task.data.title}
      />

      <View style={styles.chips}>
        <StatusChip
          label={task.data.isOverdue ? "Overdue" : taskStatusLabels[task.data.status]}
          tone={
            task.data.isOverdue
              ? "warning"
              : task.data.status === "completed"
                ? "success"
                : task.data.status === "open"
                  ? "info"
                  : "neutral"
          }
        />
        <StatusChip label={`${taskPriorityLabels[task.data.priority]} priority`} />
        {task.data.assignmentMode === "open" ? (
          <StatusChip label="Volunteer task" tone="info" />
        ) : null}
      </View>

      {actions.canEdit ? (
        <View style={styles.headerAction}>
          <AppButton
            label="Edit task"
            onPress={() =>
              router.push({
                pathname: "/work/[id]/edit",
                params: { id: taskId },
              })
            }
            variant="secondary"
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Overview" />
        <InformationCard emphasis>
          <Text style={task.data.description ? styles.description : styles.muted}>
            {task.data.description || "No description provided."}
          </Text>
          {sourceContext ? (
            <View style={styles.sourceContext}>
              <Text style={styles.sourceLabel}>SOURCE</Text>
              <Text style={styles.sourceValue}>{sourceContext}</Text>
            </View>
          ) : null}
        </InformationCard>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Task details" />
        <InformationCard style={styles.listCard}>
          <DetailRow label="Due date" value={formatTaskDate(task.data.dueDate)} />
          <Divider />
          <DetailRow label="Created" value={formatTimestamp(task.data.createdAt)} />
          <Divider />
          <DetailRow label="Updated" value={formatTimestamp(task.data.updatedAt)} />
          {task.data.completedAt ? (
            <>
              <Divider />
              <DetailRow label="Completed" value={formatTimestamp(task.data.completedAt)} />
            </>
          ) : null}
        </InformationCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          description={
            task.data.status === "open"
              ? "This volunteer task has not been claimed."
              : "Active users responsible for this task"
          }
          title="Assignees"
        />
        {activeAssignees.length === 0 ? (
          <InformationCard>
            <ListRow
              subtitle="An eligible Committee Member may claim this task."
              title="No active assignee"
            />
          </InformationCard>
        ) : (
          <InformationCard style={styles.listCard}>
            {activeAssignees.map((assignee, index) => (
              <View key={assignee.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow subtitle={assignee.roleLabel} title={assignee.displayName} />
              </View>
            ))}
          </InformationCard>
        )}
      </View>

      {actions.canClaim ? (
        <ActionSection
          description="Volunteer for this open task. Only one eligible claimant can succeed."
          title="Claim task"
        >
          <AppButton
            disabled={mutationPending}
            label="Claim task"
            loading={claim.isPending}
            onPress={confirmClaim}
          />
        </ActionSection>
      ) : null}

      {actions.canStart ? (
        <ActionSection
          description="Start the task when work has actually begun."
          title="Begin work"
        >
          <AppButton
            disabled={mutationPending}
            label="Start task"
            loading={start.isPending}
            onPress={confirmStart}
          />
        </ActionSection>
      ) : null}

      {actions.canAddProgress ? (
        <ActionSection
          description="Record a concise update for authorized users."
          title="Progress update"
        >
          <FormTextInput
            maxLength={5000}
            multiline
            onChangeText={setProgressRemark}
            placeholder="Add progress note"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.multiline]}
            textAlignVertical="top"
            value={progressRemark}
          />
          <AppButton
            disabled={mutationPending || !progressRemark.trim()}
            label="Add progress"
            loading={progress.isPending}
            onPress={addProgress}
          />
        </ActionSection>
      ) : null}

      {actions.canComplete ? (
        <ActionSection
          description="Completion notes are optional. Completed tasks become immutable."
          title="Complete task"
        >
          <FormTextInput
            maxLength={5000}
            multiline
            onChangeText={setCompletionNotes}
            placeholder="Completion notes (optional)"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.multiline]}
            textAlignVertical="top"
            value={completionNotes}
          />
          <AppButton
            disabled={mutationPending}
            label="Complete task"
            loading={complete.isPending}
            onPress={confirmComplete}
          />
        </ActionSection>
      ) : null}

      <View style={styles.section}>
        <SectionHeader description="Permanent progress and state-change history" title="Activity" />
        {task.data.activity.length === 0 ? (
          <EmptyState
            description="Progress and state changes will appear here."
            title="No activity recorded"
          />
        ) : (
          <InformationCard style={styles.activityCard}>
            {task.data.activity.map((activity, index) => (
              <View key={activity.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.activityRow}>
                  <View style={styles.activityMarker} />
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle}>{activityLabel(activity.activityType)}</Text>
                    {activity.remark ? (
                      <Text style={styles.activityRemark}>{activity.remark}</Text>
                    ) : null}
                    <Text style={styles.activityDate}>{formatTimestamp(activity.createdAt)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </InformationCard>
        )}
      </View>
    </Screen>
  );
}

function ActionSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader description={description} title={title} />
      <InformationCard style={styles.actionCard}>{children}</InformationCard>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
          title="Task unavailable"
        />
      ) : null}
      {!loading && !onRetry ? <EmptyState description={copy} title="Task unavailable" /> : null}
    </Screen>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

function activityLabel(type: string) {
  return (
    {
      task_created: "Task created",
      task_updated: "Task updated",
      assignment_added: "Assignee added",
      assignment_removed: "Assignee removed",
      progress_added: "Progress added",
      status_changed: "Status changed",
      task_completed: "Task completed",
    }[type] ?? "Task activity"
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  headerAction: { marginTop: spacing.lg },
  section: { gap: spacing.md, marginTop: spacing.section },
  description: { color: colors.text, ...typography.body },
  muted: { color: colors.secondary, ...typography.body },
  sourceContext: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.control,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  sourceLabel: { color: colors.deepEmerald, ...typography.eyebrow },
  sourceValue: { color: colors.text, marginTop: spacing.xs, ...typography.bodySmall },
  listCard: { paddingBottom: 0, paddingTop: 0 },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-between",
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  detailLabel: { color: colors.secondary, flexShrink: 0, ...typography.bodySmall },
  detailValue: {
    color: colors.text,
    flex: 1,
    textAlign: "right",
    ...typography.label,
  },
  actionCard: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multiline: { minHeight: 112 },
  activityCard: { paddingBottom: 0, paddingTop: 0 },
  activityRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  activityMarker: {
    backgroundColor: colors.gold,
    borderRadius: 3,
    height: 6,
    marginTop: 7,
    width: 6,
  },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.text, ...typography.cardTitle },
  activityRemark: { color: colors.text, marginTop: spacing.xs, ...typography.bodySmall },
  activityDate: { color: colors.textMuted, marginTop: spacing.xs, ...typography.caption },
  pageState: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
});
