import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { AppIcon, type AppIconName } from "../../../../src/components/AppIcon";
import { AppText as Text } from "../../../../src/components/AppText";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
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
import { fontFamilies, radii, spacing } from "../../../../src/theme/tokens";

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
    return <PageState copy="Meeting access could not be checked." onRetry={() => void capabilities.refetch()} />;
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
            tintColor={colors.purple}
          />
        ),
      }}
    >
      <BrandedPageHeader
        action={capabilities.data?.canAdministerCommitteeMeetings ? (
          <AppButton
            icon={<AppIcon color={colors.white} name="plus" size={18} />}
            label="Create meeting"
            onPress={() => router.push("/meetings/create")}
          />
        ) : undefined}
        description="Schedules, attendance, decisions, and follow-up work."
        title="Meetings"
      />

      {meetings.isLoading ? <LoadingState label="Loading meetings" /> : null}
      {meetings.isError ? (
        <ErrorState
          action={<AppButton label="Retry" onPress={() => void meetings.refetch()} variant="secondary" />}
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
          <MeetingGroup icon="calendar-clock-outline" meetings={groups.upcoming} title="Upcoming" tone="purple" />
          {groups.past.length > 0 ? (
            <MeetingGroup icon="calendar-check-outline" meetings={groups.past} title="Past" tone="blue" />
          ) : null}
          {groups.cancelled.length > 0 ? (
            <MeetingGroup icon="calendar-remove-outline" meetings={groups.cancelled} title="Cancelled" tone="neutral" />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const groupTones = {
  purple: { background: colors.purpleSurface, border: "#E5D8FB", icon: colors.purple },
  blue: { background: colors.blueSurface, border: "#D8E8FA", icon: colors.primaryBlue },
  neutral: { background: colors.surfaceMuted, border: colors.border, icon: colors.textMuted },
} as const;

function MeetingGroup({ icon, meetings, title, tone }: {
  icon: AppIconName;
  meetings: CommitteeMeetingSummary[];
  title: string;
  tone: keyof typeof groupTones;
}) {
  const palette = groupTones[tone];

  if (meetings.length === 0) {
    return title === "Upcoming" ? (
      <View style={[styles.group, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <GroupHeader count={0} icon={icon} iconColor={palette.icon} title={title} />
        <View style={styles.compactEmpty}>
          <Text style={styles.emptyTitle}>Schedule is clear</Text>
          <Text style={styles.emptyCopy}>No upcoming meetings are currently visible.</Text>
        </View>
      </View>
    ) : null;
  }

  return (
    <View style={[styles.group, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <GroupHeader count={meetings.length} icon={icon} iconColor={palette.icon} title={title} />
      <View style={styles.cards}>
        {meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}
      </View>
    </View>
  );
}

function GroupHeader({ count, icon, iconColor, title }: {
  count: number;
  icon: AppIconName;
  iconColor: string;
  title: string;
}) {
  return (
    <View style={styles.groupHeader}>
      <View style={styles.groupTitleRow}>
        <AppIcon color={iconColor} name={icon} size={21} />
        <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
      </View>
      <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>
    </View>
  );
}

function MeetingCard({ meeting }: { meeting: CommitteeMeetingSummary }) {
  return (
    <Pressable
      accessibilityLabel={`View meeting: ${meeting.title}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/meetings/[id]", params: { id: meeting.id } })}
      style={({ pressed }) => [styles.meetingCard, pressed && styles.pressed]}
    >
      <View style={styles.meetingTopRow}>
        <Text numberOfLines={2} style={styles.meetingTitle}>{meeting.title}</Text>
        <AppIcon color={colors.textMuted} name="chevron-right" size={21} />
      </View>
      <View style={styles.metaRow}>
        <AppIcon color={colors.purple} name="calendar-blank-outline" size={16} />
        <Text style={styles.metaText}>{formatMeetingDateTime(meeting.scheduledStart)}</Text>
      </View>
      <View style={styles.metaRow}>
        <AppIcon color={colors.textMuted} name="map-marker-outline" size={16} />
        <Text numberOfLines={2} style={styles.metaText}>{meeting.location ?? "Location not specified"}</Text>
      </View>
      <View style={styles.cardFooter}>
        <StatusChip
          label={meetingStatusLabel(meeting)}
          tone={meeting.status === "cancelled" ? "neutral" : meeting.status === "scheduled" ? "success" : "info"}
        />
        <Text style={styles.typeText}>{meetingTypeLabel(meeting.meetingType)}</Text>
      </View>
    </Pressable>
  );
}

function PageState({ copy, loading = false, onRetry }: { copy: string; loading?: boolean; onRetry?: () => void }) {
  return (
    <Screen contentContainerStyle={styles.pageState}>
      {loading ? <LoadingState label={copy} /> : null}
      {!loading && onRetry ? (
        <ErrorState action={<AppButton label="Retry" onPress={onRetry} variant="secondary" />} description={copy} title="Meetings unavailable" />
      ) : null}
      {!loading && !onRetry ? <EmptyState description={copy} title="Meetings unavailable" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  groups: { gap: spacing.lg, marginTop: spacing.xl },
  group: { borderRadius: radii.card, borderWidth: 1, padding: spacing.md },
  groupHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  groupTitleRow: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  groupTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 22 },
  countBadge: { alignItems: "center", backgroundColor: colors.white, borderRadius: 999, justifyContent: "center", minHeight: 28, minWidth: 28, paddingHorizontal: 8 },
  countText: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 13 },
  cards: { gap: spacing.sm },
  meetingCard: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, minHeight: 44, padding: spacing.md },
  meetingTopRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  meetingTitle: { color: colors.textStrong, flex: 1, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: spacing.sm },
  metaText: { color: colors.textMuted, flex: 1, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17 },
  cardFooter: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between", marginTop: spacing.md },
  typeText: { color: colors.textMuted, fontFamily: fontFamilies.medium, fontSize: 12 },
  compactEmpty: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, padding: spacing.md },
  emptyTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 14 },
  emptyCopy: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17, marginTop: 3 },
  pressed: { opacity: 0.72 },
  pageState: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
