import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../../src/auth/AuthProvider";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  committeeTaskListQueryKey,
  listCommitteeTasks,
} from "../../../src/modules/work";
import {
  formatTaskDate,
  taskPriorityLabels,
  taskStatusLabels,
  workListState,
} from "../../../src/modules/work-presentation";
import { colors } from "../../../src/theme/colors";

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
        copy="Committee work could not load."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }

  if (!canRead) {
    return (
      <PageState copy="Committee work is not available for this account." />
    );
  }

  const items = tasks.data ?? [];
  const state = workListState({
    loading: tasks.isLoading,
    error: tasks.isError,
    count: items.length,
  });

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
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>COMMITTEE OPERATIONS</Text>
          <Text style={styles.title}>Work</Text>
          <Text style={styles.intro}>
            Assigned committee tasks and progress.
          </Text>
        </View>

        {capabilities.data?.canAssignCommitteeTasks ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/work/create")}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        ) : null}
      </View>

      {state === "loading" ? (
        <StatePanel loading copy="Loading tasks..." />
      ) : null}

      {state === "error" ? (
        <StatePanel
          copy="Tasks could not load. Check your connection and try again."
          onRetry={() => void tasks.refetch()}
        />
      ) : null}

      {state === "empty" ? (
        <StatePanel copy="No committee tasks are currently available to you." />
      ) : null}

      {state === "ready"
        ? items.map((task) => (
            <Pressable
              key={task.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/work/[id]",
                  params: { id: task.id },
                })
              }
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <Text numberOfLines={2} style={styles.cardTitle}>
                  {task.title}
                </Text>

                <Text style={styles.arrow}>›</Text>
              </View>

              <View style={styles.badgeRow}>
                <Text style={styles.statusBadge}>
                  {taskStatusLabels[task.status]}
                </Text>

                <Text style={styles.priorityBadge}>
                  {taskPriorityLabels[task.priority]}
                </Text>
              </View>

              <Text style={styles.meta}>
                Due: {formatTaskDate(task.dueDate)}
              </Text>

              <Text style={styles.meta}>
                {task.assigneeIds.length}{" "}
                {task.assigneeIds.length === 1 ? "assignee" : "assignees"}
              </Text>
            </Pressable>
          ))
        : null}
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

function StatePanel({
  copy,
  loading = false,
  onRetry,
}: {
  copy: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.statePanel}>
      {loading ? <ActivityIndicator color={colors.deepEmerald} /> : null}
      <Text style={styles.stateCopy}>{copy}</Text>

      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 44,
  },
  headerRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
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
  createButton: {
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  cardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    paddingRight: 12,
  },
  arrow: {
    color: colors.deepEmerald,
    fontSize: 24,
    lineHeight: 24,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
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
    backgroundColor: colors.ivory,
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
  meta: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    padding: 24,
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
