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
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { FormTextInput, Screen } from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  addCommitteeTaskProgress,
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
  taskStatusLabels,
} from "../../../../src/modules/work-presentation";
import { colors } from "../../../../src/theme/colors";
import { spacing } from "../../../../src/theme/tokens";

export default function CommitteeTaskDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";

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
    mutationFn: ({
      remark,
      operationId,
    }: {
      remark: string;
      operationId: string;
    }) => addCommitteeTaskProgress(taskId, remark, operationId),

    onSuccess: async () => {
      setProgressRemark("");
      await refreshTaskData();
    },

    onError: (error) => {
      Alert.alert("Progress could not be added", taskErrorMessage(error));
    },
  });

  const start = useMutation({
    mutationFn: (operationId: string) =>
      startCommitteeTask(taskId, operationId),

    onSuccess: refreshTaskData,

    onError: (error) => {
      Alert.alert("Task could not be started", taskErrorMessage(error));
    },
  });

  const complete = useMutation({
    mutationFn: ({
      notes,
      operationId,
    }: {
      notes: string;
      operationId: string;
    }) => completeCommitteeTask(taskId, notes, operationId),

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
    return (
      <PageState copy="This committee task is not available for your account." />
    );
  }

  if (task.isLoading) {
    return <PageState loading copy="Loading task..." />;
  }

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
      canManageCommitteeTasks:
        capabilities.data?.canManageCommitteeTasks === true,
      canAssignCommitteeTasks:
        capabilities.data?.canAssignCommitteeTasks === true,
    },
    task: task.data,
  });

  const activeAssignees = task.data.assignees.filter(
    (assignee) => assignee.removedAt === null,
  );

  const mutationPending =
    progress.isPending || start.isPending || complete.isPending;

  const addProgress = () => {
    const remark = progressRemark.trim();

    if (!remark) {
      Alert.alert("Progress note required", "Enter a progress update first.");
      return;
    }

    if (mutationPending) return;

    progress.mutate({
      remark,
      operationId: createCommitteeOperationId(),
    });
  };

  const confirmStart = () => {
    if (mutationPending) return;

    Alert.alert(
      "Start task?",
      "The task status will change to In progress.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start task",
          onPress: () =>
            start.mutate(createCommitteeOperationId()),
        },
      ],
    );
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
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>COMMITTEE TASK</Text>
          <Text style={styles.title}>{task.data.title}</Text>
        </View>

        {actions.canEdit ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/work/[id]/edit",
                params: { id: taskId },
              })
            }
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.badgeRow}>
        <Text style={styles.statusBadge}>
          {taskStatusLabels[task.data.status]}
        </Text>
        <Text style={styles.priorityBadge}>
          {taskPriorityLabels[task.data.priority]} priority
        </Text>
      </View>

      {task.data.description ? (
        <Text style={styles.description}>{task.data.description}</Text>
      ) : (
        <Text style={styles.muted}>No description provided.</Text>
      )}

      <SectionTitle title="Task details" />

      <View style={styles.card}>
        <DetailRow
          label="Due date"
          value={formatTaskDate(task.data.dueDate)}
        />
        <DetailRow
          label="Created"
          value={formatTimestamp(task.data.createdAt)}
        />
        <DetailRow
          label="Updated"
          value={formatTimestamp(task.data.updatedAt)}
        />
        {task.data.completedAt ? (
          <DetailRow
            label="Completed"
            value={formatTimestamp(task.data.completedAt)}
          />
        ) : null}
      </View>

      <SectionTitle title="Assignees" />

      {activeAssignees.length === 0 ? (
        <Text style={styles.muted}>No active assignees.</Text>
      ) : (
        activeAssignees.map((assignee) => (
          <View key={assignee.id} style={styles.assigneeCard}>
            <Text style={styles.assigneeName}>{assignee.displayName}</Text>
            <Text style={styles.assigneeRole}>{assignee.roleLabel}</Text>
          </View>
        ))
      )}

      {actions.canStart ? (
        <>
          <SectionTitle title="Begin work" />
          <Text style={styles.help}>
            Start the task when work has actually begun.
          </Text>

          <PrimaryButton
            disabled={mutationPending}
            label={start.isPending ? "Starting..." : "Start task"}
            onPress={confirmStart}
          />
        </>
      ) : null}

      {actions.canAddProgress ? (
        <>
          <SectionTitle title="Progress update" />
          <Text style={styles.help}>
            Record a concise update so authorized users can follow progress.
          </Text>

          <FormTextInput
            maxLength={5000}
            multiline
            onChangeText={setProgressRemark}
            placeholder="Add progress note"
            placeholderTextColor="#93A099"
            style={[styles.input, styles.multiline]}
            textAlignVertical="top"
            value={progressRemark}
          />

          <PrimaryButton
            disabled={mutationPending || !progressRemark.trim()}
            label={progress.isPending ? "Adding..." : "Add progress"}
            onPress={addProgress}
          />
        </>
      ) : null}

      {actions.canComplete ? (
        <>
          <SectionTitle title="Complete task" />
          <Text style={styles.help}>
            Completion notes are optional. Once completed, the task becomes
            immutable.
          </Text>

          <FormTextInput
            maxLength={5000}
            multiline
            onChangeText={setCompletionNotes}
            placeholder="Completion notes (optional)"
            placeholderTextColor="#93A099"
            style={[styles.input, styles.multiline]}
            textAlignVertical="top"
            value={completionNotes}
          />

          <PrimaryButton
            disabled={mutationPending}
            label={complete.isPending ? "Completing..." : "Complete task"}
            onPress={confirmComplete}
          />
        </>
      ) : null}

      <SectionTitle title="Activity" />

      {task.data.activity.length === 0 ? (
        <Text style={styles.muted}>No activity recorded yet.</Text>
      ) : (
        task.data.activity.map((activity) => (
          <View key={activity.id} style={styles.activityCard}>
            <Text style={styles.activityTitle}>
              {activityLabel(activity.activityType)}
            </Text>

            {activity.remark ? (
              <Text style={styles.activityRemark}>{activity.remark}</Text>
            ) : null}

            <Text style={styles.activityDate}>
              {formatTimestamp(activity.createdAt)}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && styles.disabled]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
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
      {loading ? <ActivityIndicator color={colors.deepEmerald} /> : null}
      <Text style={styles.stateCopy}>{copy}</Text>

      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : date.toLocaleString();
}

function activityLabel(type: string) {
  switch (type) {
    case "task_created":
      return "Task created";
    case "task_updated":
      return "Task updated";
    case "assignment_added":
      return "Assignee added";
    case "assignment_removed":
      return "Assignee removed";
    case "progress_added":
      return "Progress added";
    case "status_changed":
      return "Status changed";
    case "task_completed":
      return "Task completed";
    default:
      return "Task activity";
  }
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 44,
  },
  headingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headingCopy: {
    flex: 1,
    paddingRight: 14,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 35,
    marginTop: 8,
  },
  editButton: {
    borderColor: colors.deepEmerald,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editButtonText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  statusBadge: {
    backgroundColor: colors.sand,
    borderRadius: 999,
    color: colors.deepEmerald,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priorityBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.secondary,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  description: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "700",
    marginTop: spacing.section,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  detailRow: {
    alignItems: "center",
    borderBottomColor: colors.sand,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
  },
  detailLabel: {
    color: colors.secondary,
    fontSize: 13,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 18,
    textAlign: "right",
  },
  assigneeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    padding: 14,
  },
  assigneeName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  assigneeRole: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  help: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: "#D9D3C6",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 100,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.55,
  },
  activityCard: {
    borderLeftColor: colors.gold,
    borderLeftWidth: 2,
    marginTop: 12,
    paddingLeft: 14,
    paddingVertical: 4,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  activityRemark: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  activityDate: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 5,
  },
  muted: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  pageState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
});
