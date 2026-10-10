import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../src/auth/AuthProvider";
import { CommitteeTaskForm } from "../../../src/components/CommitteeTaskForm";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  InformationCard,
  LoadingState,
  SectionHeader,
} from "../../../src/components/InstitutionalUI";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  committeeAssigneeOptionsQueryKey,
  committeeTaskListQueryKey,
  createCommitteeOperationId,
  createCommitteeTask,
  createOpenCommitteeTask,
  listCommitteeAssigneeOptions,
  type CommitteeTaskDraft,
} from "../../../src/modules/work";
import {
  isValidOpenTaskDraft,
  isValidTaskDraft,
  taskErrorMessage,
} from "../../../src/modules/work-presentation";
import { colors } from "../../../src/theme/colors";
import { borders, radii, spacing, touchTargets, typography } from "../../../src/theme/tokens";

type AssignmentMode = "direct" | "open";

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
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("direct");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canAssign = capabilities.data?.canAssignCommitteeTasks === true;
  const assignees = useQuery({
    queryKey: committeeAssigneeOptionsQueryKey(),
    queryFn: listCommitteeAssigneeOptions,
    enabled: canAssign && assignmentMode === "direct",
  });
  const create = useMutation({
    mutationFn: ({
      mode,
      operationId,
      taskDraft,
    }: {
      mode: AssignmentMode;
      operationId: string;
      taskDraft: CommitteeTaskDraft;
    }) =>
      mode === "open"
        ? createOpenCommitteeTask(
            {
              title: taskDraft.title,
              description: taskDraft.description,
              priority: taskDraft.priority,
              dueDate: taskDraft.dueDate,
            },
            operationId,
          )
        : createCommitteeTask(taskDraft, operationId),
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({
        queryKey: committeeTaskListQueryKey(account?.id),
      });
      router.replace({ pathname: "/work/[id]", params: { id: task.id } });
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
      <PageState copy="Task creation could not load." onRetry={() => void capabilities.refetch()} />
    );
  }
  if (!canAssign) {
    return <PageState copy="Task creation is not available for this account." />;
  }
  if (assignmentMode === "direct" && assignees.isLoading) {
    return <PageState loading copy="Loading eligible assignees..." />;
  }
  if (assignmentMode === "direct" && assignees.isError) {
    return (
      <PageState
        copy="Eligible assignees could not load."
        onRetry={() => void assignees.refetch()}
      />
    );
  }

  const valid = assignmentMode === "open" ? isValidOpenTaskDraft(draft) : isValidTaskDraft(draft);
  const submit = () => {
    if (create.isPending) return;
    if (!valid) {
      Alert.alert(
        "Check task details",
        assignmentMode === "direct"
          ? "Enter a task title, choose at least one assignee, and use YYYY-MM-DD for the due date if provided."
          : "Enter a task title and use YYYY-MM-DD for the due date if provided.",
      );
      return;
    }
    create.mutate({
      mode: assignmentMode,
      taskDraft: assignmentMode === "open" ? { ...draft, assigneeIds: [] } : draft,
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
      <BrandedPageHeader
        description="Define authorized committee work and its assignment model."
        eyebrow="Committee operations"
        title="Create task"
      />

      <View style={styles.section}>
        <SectionHeader
          description="Choose direct responsibility or an eligible volunteer opportunity."
          title="Assignment model"
        />
        <View style={styles.segmentRow}>
          {(["direct", "open"] as AssignmentMode[]).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected: assignmentMode === mode }}
              onPress={() => setAssignmentMode(mode)}
              style={[styles.segment, assignmentMode === mode && styles.segmentSelected]}
            >
              <Text
                style={[styles.segmentText, assignmentMode === mode && styles.segmentTextSelected]}
              >
                {mode === "direct" ? "Direct assignment" : "Open volunteer"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.modeHelp}>
          {assignmentMode === "direct"
            ? "Selected active users receive the task directly."
            : "The task starts unassigned and one eligible Committee Member may claim it."}
        </Text>
      </View>

      {assignmentMode === "direct" && assignees.data?.length === 0 ? (
        <View style={styles.section}>
          <EmptyState
            description="No eligible active users are currently available for direct assignment."
            title="No assignees available"
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <InformationCard>
          <CommitteeTaskForm
            draft={draft}
            options={assignees.data ?? []}
            pending={create.isPending}
            showAssignees={assignmentMode === "direct"}
            submitLabel={assignmentMode === "direct" ? "Create assigned task" : "Create open task"}
            onChange={setDraft}
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
          title="Task creation unavailable"
        />
      ) : null}
      {!loading && !onRetry ? (
        <EmptyState description={copy} title="Task creation unavailable" />
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
  section: { gap: spacing.md, marginTop: spacing.section },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  segment: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    flexBasis: 140,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.md,
  },
  segmentSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  segmentText: { color: colors.secondary, textAlign: "center", ...typography.label },
  segmentTextSelected: { color: colors.surface },
  modeHelp: { color: colors.secondary, ...typography.bodySmall },
  pageState: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
});
