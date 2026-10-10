import { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { CommitteeMeetingForm } from "../../../../src/components/CommitteeMeetingForm";
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
  committeeMeetingListQueryKey,
  committeeMeetingParticipantOptionsQueryKey,
  createCommitteeMeeting,
  createCommitteeMeetingOperationId,
  listCommitteeMeetingParticipantOptions,
  type CommitteeMeetingDraft,
} from "../../../../src/modules/meetings";
import { spacing } from "../../../../src/theme/tokens";

const initialDraft: CommitteeMeetingDraft = {
  title: "",
  meetingType: "general",
  details: "",
  location: "",
  scheduledStart: "",
  scheduledEnd: "",
  participantIds: [],
};

export default function CreateCommitteeMeetingScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(initialDraft);
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canAdminister = capabilities.data?.canAdministerCommitteeMeetings === true;
  const options = useQuery({
    queryKey: committeeMeetingParticipantOptionsQueryKey(),
    queryFn: listCommitteeMeetingParticipantOptions,
    enabled: canAdminister,
  });
  const create = useMutation({
    mutationFn: () => createCommitteeMeeting(draft, createCommitteeMeetingOperationId()),
    onSuccess: async (meeting) => {
      await queryClient.invalidateQueries({
        queryKey: committeeMeetingListQueryKey(account?.id),
      });
      router.replace({
        pathname: "/work/meetings/[id]",
        params: { id: meeting.id },
      });
    },
    onError: () => {
      Alert.alert("Meeting could not be created", "Review the details and try again.");
    },
  });

  if (!account || capabilities.isLoading) return <PageState loading />;
  if (capabilities.isError || !canAdminister) {
    return <PageState copy="Meeting creation is not available for this account." />;
  }
  if (options.isLoading) return <PageState loading />;
  if (options.isError) {
    return (
      <PageState
        copy="Eligible participants could not be loaded."
        onRetry={() => void options.refetch()}
      />
    );
  }

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
    >
      <BrandedPageHeader
        description="Schedule an authorized committee meeting and select its participants."
        eyebrow="Committee meetings"
        title="Create meeting"
      />
      <InformationCard style={styles.formCard}>
        <CommitteeMeetingForm
          draft={draft}
          onChange={setDraft}
          onSubmit={() => {
            if (!create.isPending) create.mutate();
          }}
          options={options.data ?? []}
          pending={create.isPending}
          submitLabel="Create meeting"
        />
      </InformationCard>
    </Screen>
  );
}

function PageState({
  copy = "Loading meeting form...",
  loading = false,
  onRetry,
}: {
  copy?: string;
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
          title="Meeting form unavailable"
        />
      ) : null}
      {!loading && !onRetry ? (
        <EmptyState description={copy} title="Meeting form unavailable" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  formCard: { marginTop: spacing.section },
  pageState: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
