import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";

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
import { Screen } from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  committeeMeetingListQueryKey,
  listCommitteeMeetings,
  type CommitteeMeetingSummary,
} from "../../../../src/modules/meetings";
import {
  formatMeetingDateTime,
  groupCommitteeMeetings,
  meetingStatusLabel,
  meetingTypeLabel,
} from "../../../../src/modules/meeting-presentation";
import { colors } from "../../../../src/theme/colors";
import { spacing } from "../../../../src/theme/tokens";

export default function CommitteeMeetingsScreen() {
  const { account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canRead = capabilities.data?.canReadCommitteeMeetings === true;
  const meetings = useQuery({
    queryKey: committeeMeetingListQueryKey(account?.id),
    queryFn: listCommitteeMeetings,
    enabled: canRead,
  });

  if (!account || capabilities.isLoading) {
    return <PageState loading copy="Loading committee meetings..." />;
  }
  if (capabilities.isError) {
    return (
      <PageState
        copy="Meeting access could not be checked."
        onRetry={() => void capabilities.refetch()}
      />
    );
  }
  if (!canRead) {
    return <PageState copy="Committee meetings are not available for this account." />;
  }

  const groups = groupCommitteeMeetings(meetings.data ?? []);

  return (
    <Screen
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={meetings.isRefetching}
            onRefresh={() => void meetings.refetch()}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <BrandedPageHeader
        description="Schedules, participants, attendance, decisions, and follow-up work."
        eyebrow="Committee operations"
        title="Meetings"
      />

      {capabilities.data?.canAdministerCommitteeMeetings ? (
        <View style={styles.primaryAction}>
          <AppButton label="Create meeting" onPress={() => router.push("/work/meetings/create")} />
        </View>
      ) : null}

      {meetings.isLoading ? <LoadingState label="Loading meetings" /> : null}
      {meetings.isError ? (
        <ErrorState
          action={
            <AppButton label="Retry" onPress={() => void meetings.refetch()} variant="secondary" />
          }
          description="Meetings could not load. Check your connection and try again."
          title="Meetings unavailable"
        />
      ) : null}
      {!meetings.isLoading && !meetings.isError && (meetings.data?.length ?? 0) === 0 ? (
        <EmptyState
          description="No committee meetings are currently visible to this account."
          title="No meetings available"
        />
      ) : null}

      {!meetings.isLoading && !meetings.isError && (meetings.data?.length ?? 0) > 0 ? (
        <View style={styles.groups}>
          <MeetingGroup
            description="Scheduled meetings requiring the clearest attention"
            meetings={groups.upcoming}
            title="Upcoming"
          />
          {groups.past.length > 0 ? (
            <MeetingGroup
              description="Completed schedule history retained for reference"
              meetings={groups.past}
              title="Past"
            />
          ) : null}
          {groups.cancelled.length > 0 ? (
            <MeetingGroup
              description="Cancelled meetings remain visible as institutional history"
              meetings={groups.cancelled}
              subdued
              title="Cancelled"
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function MeetingGroup({
  description,
  meetings,
  subdued = false,
  title,
}: {
  description: string;
  meetings: CommitteeMeetingSummary[];
  subdued?: boolean;
  title: string;
}) {
  if (meetings.length === 0) {
    return title === "Upcoming" ? (
      <View style={styles.group}>
        <SectionHeader description={description} title={title} />
        <EmptyState
          description="No upcoming meetings are currently visible."
          title="Schedule is clear"
        />
      </View>
    ) : null;
  }

  return (
    <View style={styles.group}>
      <SectionHeader description={description} title={title} />
      <InformationCard style={[styles.listCard, subdued && styles.subdued]}>
        {meetings.map((meeting, index) => (
          <View key={meeting.id}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              meta={`${meeting.location ?? "Location not specified"} · ${meeting.participantIds.length} participant${meeting.participantIds.length === 1 ? "" : "s"}`}
              onPress={() =>
                router.push({
                  pathname: "/work/meetings/[id]",
                  params: { id: meeting.id },
                })
              }
              subtitle={`${meetingTypeLabel(meeting.meetingType)} · ${formatMeetingDateTime(meeting.scheduledStart)}`}
              title={meeting.title}
              trailing={
                <StatusChip
                  label={meetingStatusLabel(meeting)}
                  tone={
                    meeting.status === "cancelled"
                      ? "neutral"
                      : title === "Upcoming"
                        ? "success"
                        : "info"
                  }
                />
              }
            />
          </View>
        ))}
      </InformationCard>
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
          title="Meetings unavailable"
        />
      ) : null}
      {!loading && !onRetry ? <EmptyState description={copy} title="Meetings unavailable" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  primaryAction: { marginTop: spacing.lg },
  groups: { gap: spacing.section, marginTop: spacing.section },
  group: { gap: spacing.md },
  listCard: { paddingBottom: 0, paddingTop: 0 },
  subdued: { opacity: 0.78 },
  pageState: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
