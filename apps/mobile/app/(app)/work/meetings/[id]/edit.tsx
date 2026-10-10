import { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../../src/auth/AuthProvider";
import { CommitteeMeetingForm } from "../../../../../src/components/CommitteeMeetingForm";
import {
  BrandedPageHeader,
  EmptyState,
  InformationCard,
  LoadingState,
} from "../../../../../src/components/InstitutionalUI";
import { Screen } from "../../../../../src/components/Screen";
import { loadCapabilities } from "../../../../../src/modules/capabilities";
import {
  committeeMeetingDetailQueryKey,
  committeeMeetingInvalidationKeys,
  committeeMeetingParticipantOptionsQueryKey,
  createCommitteeMeetingOperationId,
  getCommitteeMeeting,
  listCommitteeMeetingParticipantOptions,
  type CommitteeMeetingDraft,
  updateCommitteeMeeting,
} from "../../../../../src/modules/meetings";
import { spacing } from "../../../../../src/theme/tokens";

export default function EditCommitteeMeetingScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const meetingId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [draftOverride, setDraftOverride] = useState<CommitteeMeetingDraft | null>(null);
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canAdminister = capabilities.data?.canAdministerCommitteeMeetings === true;
  const meeting = useQuery({
    queryKey: committeeMeetingDetailQueryKey(meetingId),
    queryFn: () => getCommitteeMeeting(meetingId),
    enabled: Boolean(meetingId && canAdminister),
  });
  const options = useQuery({
    queryKey: committeeMeetingParticipantOptionsQueryKey(),
    queryFn: listCommitteeMeetingParticipantOptions,
    enabled: canAdminister,
  });

  const loadedDraft = meeting.data
    ? {
        title: meeting.data.title,
        meetingType: meeting.data.meetingType,
        details: meeting.data.details ?? "",
        location: meeting.data.location ?? "",
        scheduledStart: meeting.data.scheduledStart,
        scheduledEnd: meeting.data.scheduledEnd ?? "",
        participantIds: meeting.data.participantIds,
      }
    : null;
  const draft = draftOverride ?? loadedDraft;

  const update = useMutation({
    mutationFn: (nextDraft: CommitteeMeetingDraft) =>
      updateCommitteeMeeting(meetingId, nextDraft, createCommitteeMeetingOperationId()),
    onSuccess: async () => {
      await Promise.all(
        committeeMeetingInvalidationKeys(account?.id, meetingId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      router.replace({ pathname: "/work/meetings/[id]", params: { id: meetingId } });
    },
    onError: () => {
      Alert.alert("Meeting could not be updated", "Review the details and try again.");
    },
  });

  if (!account || capabilities.isLoading || meeting.isLoading || options.isLoading) {
    return <PageState loading copy="Loading meeting..." />;
  }
  if (!canAdminister) {
    return <PageState copy="Meeting editing is not available for this account." />;
  }
  if (meeting.isError || options.isError || !meeting.data || !draft) {
    return <PageState copy="This meeting could not be loaded for editing." />;
  }
  if (meeting.data.status === "cancelled") {
    return <PageState copy="Cancelled meetings remain viewable but cannot be edited." />;
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
    >
      <BrandedPageHeader
        description="Update the schedule, agenda, location, or participant list."
        eyebrow="Committee meetings"
        title="Edit meeting"
      />
      <InformationCard style={styles.formCard}>
        <CommitteeMeetingForm
          draft={draft}
          onChange={setDraftOverride}
          onSubmit={() => {
            if (!update.isPending) update.mutate(draft);
          }}
          options={options.data ?? []}
          pending={update.isPending}
          submitLabel="Save meeting"
        />
      </InformationCard>
    </Screen>
  );
}

function PageState({ copy, loading = false }: { copy: string; loading?: boolean }) {
  return (
    <Screen contentContainerStyle={styles.pageState}>
      {loading ? <LoadingState label={copy} /> : null}
      {!loading ? <EmptyState description={copy} title="Meeting unavailable" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  formCard: { marginTop: spacing.section },
  pageState: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
