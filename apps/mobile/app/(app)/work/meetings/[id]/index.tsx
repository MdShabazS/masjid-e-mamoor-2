import { useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../../src/auth/AuthProvider";
import { CommitteeTaskForm } from "../../../../../src/components/CommitteeTaskForm";
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
} from "../../../../../src/components/InstitutionalUI";
import { FormTextInput, Screen } from "../../../../../src/components/Screen";
import { loadCapabilities } from "../../../../../src/modules/capabilities";
import {
  committeeMeetingAttendanceQueryKey,
  committeeMeetingDecisionsQueryKey,
  committeeMeetingDetailQueryKey,
  committeeMeetingInvalidationKeys,
  createCommitteeMeetingDecision,
  createCommitteeMeetingOperationId,
  getCommitteeMeeting,
  getCommitteeMeetingAttendance,
  listCommitteeMeetingDecisions,
  recordCommitteeMeetingAttendance,
  cancelCommitteeMeeting,
  type CommitteeMeetingAttendanceStatus,
} from "../../../../../src/modules/meetings";
import {
  formatMeetingDateTime,
  meetingActionVisibility,
  meetingAttendanceRows,
  meetingStatusLabel,
  meetingTypeLabel,
} from "../../../../../src/modules/meeting-presentation";
import {
  committeeAssigneeOptionsQueryKey,
  committeeTaskListQueryKey,
  createCommitteeMeetingFollowupTask,
  createCommitteeOperationId,
  createOpenCommitteeMeetingFollowupTask,
  listCommitteeAssigneeOptions,
  type CommitteeTaskDraft,
} from "../../../../../src/modules/work";
import { isValidOpenTaskDraft } from "../../../../../src/modules/work-presentation";
import { colors } from "../../../../../src/theme/colors";
import { borders, radii, spacing, typography } from "../../../../../src/theme/tokens";

const initialTaskDraft: CommitteeTaskDraft = {
  title: "",
  description: "",
  priority: "normal",
  dueDate: "",
  assigneeIds: [],
};

export default function CommitteeMeetingDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const meetingId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [decisionText, setDecisionText] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [followupMode, setFollowupMode] = useState<"direct" | "open">("direct");
  const [followupDecisionId, setFollowupDecisionId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState(initialTaskDraft);

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canRead = capabilities.data?.canReadCommitteeMeetings === true;
  const meeting = useQuery({
    queryKey: committeeMeetingDetailQueryKey(meetingId),
    queryFn: () => getCommitteeMeeting(meetingId),
    enabled: Boolean(account && meetingId && canRead),
  });
  const attendance = useQuery({
    queryKey: committeeMeetingAttendanceQueryKey(meetingId),
    queryFn: () => getCommitteeMeetingAttendance(meetingId),
    enabled: Boolean(account && meetingId && canRead),
  });
  const decisions = useQuery({
    queryKey: committeeMeetingDecisionsQueryKey(meetingId),
    queryFn: () => listCommitteeMeetingDecisions(meetingId),
    enabled: Boolean(account && meetingId && canRead),
  });
  const assigneeOptions = useQuery({
    queryKey: committeeAssigneeOptionsQueryKey(),
    queryFn: listCommitteeAssigneeOptions,
    enabled: capabilities.data?.canAssignCommitteeTasks === true,
  });

  const refreshMeeting = async () => {
    await Promise.all([
      ...committeeMeetingInvalidationKeys(account?.id, meetingId).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
      queryClient.invalidateQueries({
        queryKey: committeeMeetingAttendanceQueryKey(meetingId),
      }),
      queryClient.invalidateQueries({
        queryKey: committeeMeetingDecisionsQueryKey(meetingId),
      }),
    ]);
  };

  const attendanceMutation = useMutation({
    mutationFn: ({
      participantId,
      status,
    }: {
      participantId: string;
      status: CommitteeMeetingAttendanceStatus;
    }) =>
      recordCommitteeMeetingAttendance(
        meetingId,
        participantId,
        status,
        createCommitteeMeetingOperationId(),
      ),
    onSuccess: refreshMeeting,
    onError: () => Alert.alert("Attendance could not be recorded", "Please try again."),
  });
  const decisionMutation = useMutation({
    mutationFn: (text: string) =>
      createCommitteeMeetingDecision(meetingId, text, createCommitteeMeetingOperationId()),
    onSuccess: async () => {
      setDecisionText("");
      await refreshMeeting();
    },
    onError: () => Alert.alert("Decision could not be recorded", "Please try again."),
  });
  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      cancelCommitteeMeeting(meetingId, reason, createCommitteeMeetingOperationId()),
    onSuccess: async () => {
      setCancellationReason("");
      await refreshMeeting();
    },
    onError: () => Alert.alert("Meeting could not be cancelled", "Please try again."),
  });
  const followupMutation = useMutation({
    mutationFn: async () => {
      const operationId = createCommitteeOperationId();
      if (followupMode === "open") {
        return createOpenCommitteeMeetingFollowupTask(
          meetingId,
          followupDecisionId,
          {
            title: taskDraft.title,
            description: taskDraft.description,
            priority: taskDraft.priority,
            dueDate: taskDraft.dueDate,
          },
          operationId,
        );
      }
      return createCommitteeMeetingFollowupTask(
        meetingId,
        followupDecisionId,
        taskDraft,
        operationId,
      );
    },
    onSuccess: async (task) => {
      setTaskDraft(initialTaskDraft);
      setFollowupDecisionId(null);
      await queryClient.invalidateQueries({
        queryKey: committeeTaskListQueryKey(account?.id),
      });
      router.push({ pathname: "/work/[id]", params: { id: task.id } });
    },
    onError: () => Alert.alert("Follow-up task could not be created", "Please try again."),
  });

  if (!account || capabilities.isLoading) {
    return <PageState loading copy="Loading meeting..." />;
  }
  if (capabilities.isError || !canRead) {
    return <PageState copy="This meeting is not available for your account." />;
  }
  if (meeting.isLoading || attendance.isLoading || decisions.isLoading) {
    return <PageState loading copy="Loading meeting details..." />;
  }
  if (meeting.isError || attendance.isError || decisions.isError || !meeting.data) {
    return (
      <PageState
        copy="This meeting is unavailable or outside your authorized scope."
        onRetry={() => void refreshMeeting()}
      />
    );
  }

  const hydratedMeeting = { ...meeting.data, attendance: attendance.data ?? [] };
  const isParticipant = hydratedMeeting.participantIds.includes(account.id);
  const actions = meetingActionVisibility({
    canAdminister: capabilities.data?.canAdministerCommitteeMeetings === true,
    canAssignTasks: capabilities.data?.canAssignCommitteeTasks === true,
    canRecordAttendance: capabilities.data?.canRecordCommitteeMeetingAttendance === true,
    canWriteParticipantDecision:
      isParticipant && capabilities.data?.canRecordCommitteeMeetingAttendance === true,
    meeting: hydratedMeeting,
  });
  const attendanceRows = meetingAttendanceRows(hydratedMeeting);
  const mutationPending =
    attendanceMutation.isPending ||
    decisionMutation.isPending ||
    cancelMutation.isPending ||
    followupMutation.isPending;

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={meeting.isRefetching || attendance.isRefetching || decisions.isRefetching}
            onRefresh={() => void refreshMeeting()}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <BrandedPageHeader
        description="Schedule, participation, decisions, and accountable follow-up"
        eyebrow="Committee meeting"
        title={hydratedMeeting.title}
      />
      <View style={styles.chips}>
        <StatusChip
          label={meetingStatusLabel(hydratedMeeting)}
          tone={hydratedMeeting.status === "cancelled" ? "neutral" : "success"}
        />
        <StatusChip label={meetingTypeLabel(hydratedMeeting.meetingType)} tone="info" />
      </View>

      {actions.canEdit ? (
        <View style={styles.headerAction}>
          <AppButton
            label="Edit meeting"
            onPress={() =>
              router.push({
                pathname: "/work/meetings/[id]/edit",
                params: { id: meetingId },
              })
            }
            variant="secondary"
          />
        </View>
      ) : null}

      <MeetingOverview meeting={hydratedMeeting} />

      <View style={styles.section}>
        <SectionHeader
          description="Authorized participants and their recorded attendance"
          title="Participants & attendance"
        />
        <InformationCard style={styles.listCard}>
          {attendanceRows.map(({ attendance: entry, participant }, index) => (
            <View key={participant.applicationUserId}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.participantRow}>
                <View style={styles.participantCopy}>
                  <Text style={styles.participantName}>{participant.displayName}</Text>
                  <Text style={styles.participantRole}>{participant.roleLabel}</Text>
                  <StatusChip
                    label={
                      entry?.attendanceStatus === "present"
                        ? "Present"
                        : entry?.attendanceStatus === "absent"
                          ? "Absent"
                          : "Not yet recorded"
                    }
                    tone={
                      entry?.attendanceStatus === "present"
                        ? "success"
                        : entry?.attendanceStatus === "absent"
                          ? "danger"
                          : "neutral"
                    }
                  />
                </View>
                {actions.canRecordAttendance ? (
                  <View style={styles.attendanceActions}>
                    <AppButton
                      disabled={mutationPending}
                      label="Present"
                      loading={
                        attendanceMutation.isPending &&
                        attendanceMutation.variables?.participantId ===
                          participant.applicationUserId &&
                        attendanceMutation.variables?.status === "present"
                      }
                      onPress={() =>
                        attendanceMutation.mutate({
                          participantId: participant.applicationUserId,
                          status: "present",
                        })
                      }
                      variant="secondary"
                    />
                    <AppButton
                      disabled={mutationPending}
                      label="Absent"
                      loading={
                        attendanceMutation.isPending &&
                        attendanceMutation.variables?.participantId ===
                          participant.applicationUserId &&
                        attendanceMutation.variables?.status === "absent"
                      }
                      onPress={() =>
                        attendanceMutation.mutate({
                          participantId: participant.applicationUserId,
                          status: "absent",
                        })
                      }
                      variant="secondary"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </InformationCard>
      </View>

      <View style={styles.section}>
        <SectionHeader
          description="Append-only outcomes retained in chronological order"
          title="Decisions & outcomes"
        />
        {(decisions.data?.length ?? 0) === 0 ? (
          <EmptyState
            description="Recorded meeting decisions will appear here."
            title="No decisions recorded"
          />
        ) : (
          <InformationCard style={styles.listCard}>
            {(decisions.data ?? []).map((decision, index) => (
              <View key={decision.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  meta={formatMeetingDateTime(decision.createdAt)}
                  subtitle="Permanent meeting outcome"
                  title={decision.decisionText}
                />
              </View>
            ))}
          </InformationCard>
        )}
        {actions.canCreateDecision ? (
          <InformationCard style={styles.actionCard}>
            <FormTextInput
              maxLength={5000}
              multiline
              onChangeText={setDecisionText}
              placeholder="Record a decision or outcome"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.multiline]}
              textAlignVertical="top"
              value={decisionText}
            />
            <AppButton
              disabled={mutationPending || !decisionText.trim()}
              label="Record decision"
              loading={decisionMutation.isPending}
              onPress={() => decisionMutation.mutate(decisionText.trim())}
            />
          </InformationCard>
        ) : null}
      </View>

      {actions.canCreateFollowup ? (
        <View style={styles.section}>
          <SectionHeader
            description="Create accountable work linked to this meeting or a recorded decision."
            title="Follow-up task"
          />
          <InformationCard>
            <View style={styles.modeRow}>
              {(["direct", "open"] as const).map((mode) => (
                <AppButton
                  key={mode}
                  disabled={followupMode === mode}
                  label={mode === "direct" ? "Direct assignment" : "Open volunteer"}
                  onPress={() => setFollowupMode(mode)}
                  variant="secondary"
                />
              ))}
            </View>
            {(decisions.data?.length ?? 0) > 0 ? (
              <View style={styles.decisionLinks}>
                <Text style={styles.fieldLabel}>Link to decision (optional)</Text>
                <AppButton
                  disabled={followupDecisionId === null}
                  label="General meeting follow-up"
                  onPress={() => setFollowupDecisionId(null)}
                  variant="secondary"
                />
                {(decisions.data ?? []).map((decision) => (
                  <AppButton
                    key={decision.id}
                    disabled={followupDecisionId === decision.id}
                    label={decision.decisionText}
                    onPress={() => setFollowupDecisionId(decision.id)}
                    variant="secondary"
                  />
                ))}
              </View>
            ) : null}
            <CommitteeTaskForm
              draft={taskDraft}
              onChange={setTaskDraft}
              onSubmit={() => {
                if (mutationPending) return;
                const valid =
                  followupMode === "open"
                    ? isValidOpenTaskDraft(taskDraft)
                    : isValidOpenTaskDraft(taskDraft) && taskDraft.assigneeIds.length > 0;
                if (!valid) {
                  Alert.alert(
                    "Follow-up details required",
                    followupMode === "direct"
                      ? "Enter a title and select at least one assignee."
                      : "Enter a title for the volunteer task.",
                  );
                  return;
                }
                followupMutation.mutate();
              }}
              options={assigneeOptions.data ?? []}
              pending={followupMutation.isPending}
              showAssignees={followupMode === "direct"}
              submitLabel="Create follow-up"
            />
          </InformationCard>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader description="Permanent meeting lifecycle history" title="Activity" />
        {hydratedMeeting.activity.length === 0 ? (
          <EmptyState description="Meeting changes will appear here." title="No activity" />
        ) : (
          <InformationCard style={styles.listCard}>
            {hydratedMeeting.activity.map((activity, index) => (
              <View key={activity.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  meta={formatMeetingDateTime(activity.createdAt)}
                  title={activityLabel(activity.activityType)}
                />
              </View>
            ))}
          </InformationCard>
        )}
      </View>

      {actions.canCancel ? (
        <View style={styles.section}>
          <SectionHeader
            description="Cancellation preserves the meeting and requires a reason."
            title="Cancel meeting"
          />
          <InformationCard style={styles.actionCard}>
            <FormTextInput
              maxLength={1000}
              multiline
              onChangeText={setCancellationReason}
              placeholder="Cancellation reason"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.multiline]}
              textAlignVertical="top"
              value={cancellationReason}
            />
            <AppButton
              disabled={mutationPending || !cancellationReason.trim()}
              label="Cancel meeting"
              loading={cancelMutation.isPending}
              onPress={() =>
                Alert.alert(
                  "Cancel meeting?",
                  "The meeting will remain visible as cancelled history.",
                  [
                    { text: "Keep meeting", style: "cancel" },
                    {
                      text: "Cancel meeting",
                      style: "destructive",
                      onPress: () => cancelMutation.mutate(cancellationReason.trim()),
                    },
                  ],
                )
              }
              variant="secondary"
            />
          </InformationCard>
        </View>
      ) : null}
    </Screen>
  );
}

function MeetingOverview({
  meeting,
}: {
  meeting: Awaited<ReturnType<typeof getCommitteeMeeting>>;
}) {
  return (
    <>
      <View style={styles.section}>
        <SectionHeader title="Overview" />
        <InformationCard emphasis>
          <Text style={meeting.details ? styles.body : styles.muted}>
            {meeting.details || "No agenda or details provided."}
          </Text>
          {meeting.status === "cancelled" && meeting.cancellationReason ? (
            <View style={styles.cancelledNote}>
              <Text style={styles.fieldLabel}>Cancellation reason</Text>
              <Text style={styles.body}>{meeting.cancellationReason}</Text>
            </View>
          ) : null}
        </InformationCard>
      </View>
      <View style={styles.section}>
        <SectionHeader title="Schedule" />
        <InformationCard style={styles.listCard}>
          <DetailRow label="Starts" value={formatMeetingDateTime(meeting.scheduledStart)} />
          <Divider />
          <DetailRow label="Ends" value={formatMeetingDateTime(meeting.scheduledEnd)} />
          {meeting.location ? (
            <>
              <Divider />
              <DetailRow label="Location" value={meeting.location} />
            </>
          ) : null}
        </InformationCard>
      </View>
    </>
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
          title="Meeting unavailable"
        />
      ) : null}
      {!loading && !onRetry ? <EmptyState description={copy} title="Meeting unavailable" /> : null}
    </Screen>
  );
}

function activityLabel(type: string) {
  return (
    {
      meeting_created: "Meeting created",
      meeting_updated: "Meeting updated",
      meeting_cancelled: "Meeting cancelled",
      attendance_recorded: "Attendance recorded",
      decision_created: "Decision recorded",
    }[type] ?? "Meeting activity"
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  headerAction: { marginTop: spacing.lg },
  section: { gap: spacing.md, marginTop: spacing.section },
  body: { color: colors.text, ...typography.body },
  muted: { color: colors.secondary, ...typography.body },
  cancelledNote: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radii.control,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
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
  detailValue: { color: colors.text, flex: 1, textAlign: "right", ...typography.bodySmall },
  participantRow: { gap: spacing.md, paddingVertical: spacing.md },
  participantCopy: { gap: spacing.xs },
  participantName: { color: colors.text, ...typography.cardTitle },
  participantRole: { color: colors.secondary, ...typography.caption },
  attendanceActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionCard: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multiline: { minHeight: 104 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  decisionLinks: { gap: spacing.sm, marginVertical: spacing.lg },
  fieldLabel: { color: colors.deepEmerald, ...typography.label },
  pageState: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
