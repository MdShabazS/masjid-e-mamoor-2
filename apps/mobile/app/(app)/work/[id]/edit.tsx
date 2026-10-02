import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { CommitteeTaskForm } from "../../../../src/components/CommitteeTaskForm";
import { Screen } from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  committeeAssigneeOptionsQueryKey,
  committeeTaskDetailQueryKey,
  committeeTaskListQueryKey,
  createCommitteeOperationId,
  getCommitteeTask,
  listCommitteeAssigneeOptions,
  updateCommitteeTask,
  type CommitteeTaskDraft,
} from "../../../../src/modules/work";
import {
  isValidTaskDraft,
  taskErrorMessage,
} from "../../../../src/modules/work-presentation";
import { colors } from "../../../../src/theme/colors";

export default function EditCommitteeTaskScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";

  const { account } = useAuth();
  const queryClient = useQueryClient();

  const [draftState, setDraftState] = useState<{
    taskId: string;
    draft: CommitteeTaskDraft;
  } | null>(null);

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const canAssign =
    capabilities.data?.canAssignCommitteeTasks === true;

  const task = useQuery({
    queryKey: committeeTaskDetailQueryKey(taskId),
    queryFn: () => getCommitteeTask(taskId),
    enabled: Boolean(account && taskId && canAssign),
  });

  const assignees = useQuery({
    queryKey: committeeAssigneeOptionsQueryKey(),
    queryFn: listCommitteeAssigneeOptions,
    enabled: canAssign,
  });

  const update = useMutation({
    mutationFn: ({
      taskDraft,
      operationId,
    }: {
      taskDraft: CommitteeTaskDraft;
      operationId: string;
    }) => updateCommitteeTask(taskId, taskDraft, operationId),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: committeeTaskDetailQueryKey(taskId),
        }),
        queryClient.invalidateQueries({
          queryKey: committeeTaskListQueryKey(account?.id),
        }),
        queryClient.invalidateQueries({
          queryKey: committeeAssigneeOptionsQueryKey(),
        }),
      ]);

      router.replace({
        pathname: "/work/[id]",
        params: { id: taskId },
      });
    },

    onError: (error) => {
      Alert.alert("Task could not be updated", taskErrorMessage(error));
    },
  });

  if (!account || capabilities.isLoading) {
    return <PageState loading copy="Loading task editor..." />;
  }

  if (capabilities.isError) {
    return (
      <PageState
        copy="Task access could not be checked."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }

  if (!canAssign) {
    return (
      <PageState copy="Task editing is not available for this account." />
    );
  }

  if (task.isLoading || assignees.isLoading) {
    return <PageState loading copy="Loading task details..." />;
  }

  if (task.isError || !task.data) {
    return (
      <PageState
        copy="This task is unavailable or outside your authorized scope."
        onRetry={() => void task.refetch()}
      />
    );
  }

  if (assignees.isError) {
    return (
      <PageState
        copy="Eligible assignees could not load."
        onRetry={() => void assignees.refetch()}
      />
    );
  }

  if (task.data.status === "completed") {
    return (
      <PageState copy="Completed tasks can no longer be edited." />
    );
  }

  const serverDraft: CommitteeTaskDraft = {
    title: task.data.title,
    description: task.data.description ?? "",
    priority: task.data.priority,
    dueDate: task.data.dueDate ?? "",
    assigneeIds: task.data.assignees
      .filter((assignee) => assignee.removedAt === null)
      .map((assignee) => assignee.applicationUserId),
  };

  const draft =
    draftState?.taskId === task.data.id ? draftState.draft : serverDraft;

  const valid = isValidTaskDraft({
    title: draft.title,
    dueDate: draft.dueDate,
    assigneeIds: draft.assigneeIds,
  });

  const submit = () => {
    if (update.isPending) return;

    if (!valid) {
      Alert.alert(
        "Check task details",
        "Enter a task title, choose at least one assignee, and use YYYY-MM-DD for the due date if provided.",
      );
      return;
    }

    Alert.alert(
      "Save task changes?",
      "The task details and active assignees will be updated.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save changes",
          onPress: () =>
            update.mutate({
              taskDraft: draft,
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
    >
      <Text style={styles.eyebrow}>COMMITTEE OPERATIONS</Text>
      <Text style={styles.title}>Edit task</Text>
      <Text style={styles.intro}>
        Update the task definition or change its active assignees.
      </Text>

      {assignees.data?.length === 0 ? (
        <Text style={styles.notice}>
          No eligible active users are currently available for assignment.
        </Text>
      ) : null}

      <CommitteeTaskForm
        draft={draft}
        options={assignees.data ?? []}
        pending={update.isPending}
        submitLabel="Save changes"
        onChange={(nextDraft) =>
          setDraftState({ taskId: task.data.id, draft: nextDraft })
        }
        onSubmit={submit}
      />
    </Screen>
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

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 44,
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
  notice: {
    backgroundColor: colors.sand,
    borderRadius: 10,
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 20,
    padding: 14,
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
