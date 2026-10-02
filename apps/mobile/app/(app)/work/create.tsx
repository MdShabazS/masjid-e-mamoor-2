import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../src/auth/AuthProvider";
import { CommitteeTaskForm } from "../../../src/components/CommitteeTaskForm";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  committeeAssigneeOptionsQueryKey,
  committeeTaskListQueryKey,
  createCommitteeOperationId,
  createCommitteeTask,
  listCommitteeAssigneeOptions,
  type CommitteeTaskDraft,
} from "../../../src/modules/work";
import {
  isValidTaskDraft,
  taskErrorMessage,
} from "../../../src/modules/work-presentation";
import { colors } from "../../../src/theme/colors";

const initialDraft: CommitteeTaskDraft = {
  title: "",
  description: "",
  priority: "normal",
  dueDate: "",
  assigneeIds: [],
};

export default function CreateCommitteeTaskScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CommitteeTaskDraft>(initialDraft);

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const canAssign =
    capabilities.data?.canAssignCommitteeTasks === true;

  const assignees = useQuery({
    queryKey: committeeAssigneeOptionsQueryKey(),
    queryFn: listCommitteeAssigneeOptions,
    enabled: canAssign,
  });

  const create = useMutation({
    mutationFn: ({
      taskDraft,
      operationId,
    }: {
      taskDraft: CommitteeTaskDraft;
      operationId: string;
    }) => createCommitteeTask(taskDraft, operationId),

    onSuccess: async (task) => {
      await queryClient.invalidateQueries({
        queryKey: committeeTaskListQueryKey(account?.id),
      });

      router.replace({
        pathname: "/work/[id]",
        params: { id: task.id },
      });
    },

    onError: (error) => {
      Alert.alert("Task could not be created", taskErrorMessage(error));
    },
  });

  if (!account || capabilities.isLoading) {
    return <PageState loading copy="Loading task creation..." />;
  }

  if (capabilities.isError) {
    return (
      <PageState
        copy="Task creation could not load."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }

  if (!canAssign) {
    return (
      <PageState copy="Task creation is not available for this account." />
    );
  }

  if (assignees.isLoading) {
    return <PageState loading copy="Loading eligible assignees..." />;
  }

  if (assignees.isError) {
    return (
      <PageState
        copy="Eligible assignees could not load."
        onRetry={() => void assignees.refetch()}
      />
    );
  }

  const valid = isValidTaskDraft({
    title: draft.title,
    dueDate: draft.dueDate,
    assigneeIds: draft.assigneeIds,
  });

  const submit = () => {
    if (create.isPending) return;

    if (!valid) {
      Alert.alert(
        "Check task details",
        "Enter a task title, choose at least one assignee, and use YYYY-MM-DD for the due date if provided.",
      );
      return;
    }

    create.mutate({
      taskDraft: draft,
      operationId: createCommitteeOperationId(),
    });
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
    >
      <Text style={styles.eyebrow}>COMMITTEE OPERATIONS</Text>
      <Text style={styles.title}>Create task</Text>
      <Text style={styles.intro}>
        Define the work, choose eligible assignees, and set an optional due
        date.
      </Text>

      {assignees.data?.length === 0 ? (
        <Text style={styles.notice}>
          No eligible active users are currently available for assignment.
        </Text>
      ) : null}

      <CommitteeTaskForm
        draft={draft}
        options={assignees.data ?? []}
        pending={create.isPending}
        submitLabel="Create task"
        onChange={setDraft}
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
