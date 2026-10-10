import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { CommitteeTaskForm } from "../../../../src/components/CommitteeTaskForm";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  InformationCard,
  LoadingState,
} from "../../../../src/components/InstitutionalUI";
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
import { isValidTaskDraft, taskErrorMessage } from "../../../../src/modules/work-presentation";
import { spacing } from "../../../../src/theme/tokens";

export default function EditCommitteeTaskScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const taskId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
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
  const canAssign = capabilities.data?.canAssignCommitteeTasks === true;
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
      operationId,
      taskDraft,
    }: {
      operationId: string;
      taskDraft: CommitteeTaskDraft;
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
      router.replace({ pathname: "/work/[id]", params: { id: taskId } });
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
    return <PageState copy="Task editing is not available for this account." />;
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
    return <PageState copy="Completed tasks can no longer be edited." />;
  }
  if (task.data.status === "open") {
    return (
      <PageState copy="Open volunteer tasks must be claimed before their assignment can be edited." />
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
  const draft = draftState?.taskId === task.data.id ? draftState.draft : serverDraft;
  const valid = isValidTaskDraft(draft);
  const submit = () => {
    if (update.isPending) return;
    if (!valid) {
      Alert.alert(
        "Check task details",
        "Enter a task title, choose at least one assignee, and use YYYY-MM-DD for the due date if provided.",
      );
      return;
    }
    Alert.alert("Save task changes?", "The task details and active assignees will be updated.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save changes",
        onPress: () =>
          update.mutate({
            taskDraft: draft,
            operationId: createCommitteeOperationId(),
          }),
      },
    ]);
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
    >
      <BrandedPageHeader
        description="Update the task definition or its active assignees."
        eyebrow="Committee operations"
        title="Edit task"
      />
      {assignees.data?.length === 0 ? (
        <View style={styles.section}>
          <EmptyState
            description="No eligible active users are currently available for assignment."
            title="No assignees available"
          />
        </View>
      ) : null}
      <View style={styles.section}>
        <InformationCard>
          <CommitteeTaskForm
            draft={draft}
            options={assignees.data ?? []}
            pending={update.isPending}
            submitLabel="Save changes"
            onChange={(nextDraft) => setDraftState({ taskId: task.data.id, draft: nextDraft })}
            onSubmit={submit}
          />
        </InformationCard>
      </View>
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
      {loading ? <LoadingState label={copy} /> : null}
      {!loading && onRetry ? (
        <ErrorState
          action={<AppButton label="Retry" onPress={onRetry} variant="secondary" />}
          description={copy}
          title="Task editor unavailable"
        />
      ) : null}
      {!loading && !onRetry ? (
        <EmptyState description={copy} title="Task editor unavailable" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  section: { marginTop: spacing.section },
  pageState: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
});
