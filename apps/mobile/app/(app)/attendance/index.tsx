import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";

import { useAuth } from "../../../src/auth/AuthProvider";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppText as Text } from "../../../src/components/AppText";
import { AppButton, BrandedPageHeader, EmptyState, ErrorState, InformationCard, LoadingState, StatusChip } from "../../../src/components/InstitutionalUI";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  createJummahAttendanceOperationId,
  getCurrentJummahLocation,
  latestLocalAttendanceByEvent,
  jummahAttendanceQueryKey,
  jummahAttendanceSource,
  listJummahAttendanceEvents,
  nextJummahAttendanceCursor,
  recordSelfJummahAttendance,
  syncQueuedJummahAttendance,
  type AttendanceListPage,
  type JummahAttendanceEvent,
} from "../../../src/modules/jummah-attendance";
import { listLocalJummahAttendance } from "../../../src/modules/jummah-attendance-store";
import { colors } from "../../../src/theme/colors";
import { fontFamilies, radii, spacing } from "../../../src/theme/tokens";

interface EventCardProps {
  event: JummahAttendanceEvent;
  canRecord: boolean;
  localStatus?: "queued" | "applied" | "rejected";
  errorCode?: string | null;
  onRecord: (eventId: string) => void;
  pending: boolean;
}

export default function JummahAttendanceScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canRead = capabilities.data?.canReadJummahAttendance === true;
  const events = useInfiniteQuery<AttendanceListPage, Error, { pages: AttendanceListPage[]; pageParams: unknown[] }, readonly unknown[], { scheduledFor: string; eventId: string } | undefined>({
    queryKey: jummahAttendanceQueryKey(account?.id),
    queryFn: ({ pageParam }) => listJummahAttendanceEvents(account!.id, pageParam),
    initialPageParam: undefined,
    getNextPageParam: nextJummahAttendanceCursor,
    enabled: Boolean(account) && canRead,
  });
  const local = useQuery({
    queryKey: ["jummah-attendance", account?.id, "local-records"],
    queryFn: () => listLocalJummahAttendance(account!.id),
    enabled: Boolean(account) && canRead,
  });
  const sync = useMutation({
    mutationFn: () => syncQueuedJummahAttendance(account!.id),
    onSuccess: async (result) => {
      if (result.applied > 0 || result.rejected > 0) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: jummahAttendanceQueryKey(account?.id) }),
          queryClient.invalidateQueries({ queryKey: ["jummah-attendance", account?.id, "local-records"] }),
        ]);
      }
    },
  });
  const record = useMutation({
    mutationFn: async (eventId: string) => {
      const network = await Network.getNetworkStateAsync().catch(() => ({
        isConnected: false,
        isInternetReachable: false,
      }));
      const source = jummahAttendanceSource(network.isConnected, network.isInternetReachable);
      const location = await getCurrentJummahLocation();
      const operationId = createJummahAttendanceOperationId();
      setActiveOperationId(operationId);
      return recordSelfJummahAttendance({
        applicationUserId: account!.id,
        eventId,
        latitude: location.latitude,
        longitude: location.longitude,
        operationId,
        source,
      });
    },
    onSuccess: async () => {
      setActiveOperationId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jummahAttendanceQueryKey(account?.id) }),
        queryClient.invalidateQueries({ queryKey: ["jummah-attendance", account?.id, "local-records"] }),
      ]);
    },
    onError: async (error) => {
      setActiveOperationId(null);
      await queryClient.invalidateQueries({ queryKey: ["jummah-attendance", account?.id, "local-records"] });
      const messages: Record<string, string> = {
        location_permission_required: "Allow location access while using the app to record attendance.",
        attendance_window_closed: "The server reports that this check-in window is closed.",
        outside_attendance_radius: "The server could not verify that this location is within the 100 metre attendance area.",
        attendance_queued: "Your attempt is saved securely on this device and is waiting for server confirmation.",
      };
      Alert.alert("Attendance not confirmed", messages[error.message] ?? "The attempt could not be confirmed. Check your connection and try again.");
    },
  });

  if (!account || capabilities.isLoading) {
    return <Screen contentContainerStyle={styles.state}><LoadingState label="Checking attendance access" /></Screen>;
  }
  if (capabilities.isError) {
    return <Screen contentContainerStyle={styles.state}><ErrorState action={<AppButton label="Retry" onPress={() => void capabilities.refetch()} variant="secondary" />} description="Attendance access could not be checked." title="Attendance unavailable" /></Screen>;
  }
  if (!canRead) {
    return <Screen contentContainerStyle={styles.state}><EmptyState description="Attendance is not available for this account." title="No attendance access" /></Screen>;
  }

  const localByEvent = latestLocalAttendanceByEvent(local.data ?? []);
  const eventItems = (events.data?.pages ?? []).flatMap((page) =>
    page.events.map((event) => ({ event, fromCache: page.source === "cache" })),
  );
  const hasCachedPage = events.data?.pages.some((page) => page.source === "cache") === true;
  const queuedCount = local.data?.filter((item) => item.status === "queued").length ?? 0;

  return (
    <Screen
      contentContainerStyle={styles.content}
      scroll
      scrollViewProps={{
        refreshControl: <RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} tintColor={colors.primaryBlue} />,
      }}
    >
      <BrandedPageHeader
        action={capabilities.data?.canManageJummahAttendanceEvents === true ? (
          <AppButton label="Create event" onPress={() => router.push("/attendance/create")} icon={<AppIcon color={colors.white} name="plus" size={18} />} />
        ) : undefined}
        description="Member self-attendance with server-verified location and event windows."
        title="Jummah attendance"
      />

      {hasCachedPage ? (
        <View style={styles.offlineNotice}>
          <AppIcon color={colors.warning} name="cloud-off-outline" size={20} />
          <Text style={styles.offlineCopy}>Showing saved event details. Attendance remains pending until the server confirms it.</Text>
        </View>
      ) : null}
      {queuedCount > 0 ? (
        <View style={styles.syncNotice}>
          <View style={styles.syncCopy}>
            <Text style={styles.syncTitle}>{queuedCount} attendance {queuedCount === 1 ? "attempt" : "attempts"} awaiting sync</Text>
            <Text style={styles.syncDescription}>Only the server can confirm attendance.</Text>
          </View>
          <AppButton disabled={sync.isPending} label={sync.isPending ? "Syncing..." : "Sync now"} onPress={() => sync.mutate()} variant="secondary" />
        </View>
      ) : null}

      {events.isLoading ? <LoadingState label="Loading Jummah events" /> : null}
      {events.isError ? (
        <ErrorState
          action={<AppButton label="Retry" onPress={() => void events.refetch()} variant="secondary" />}
          description="Events could not be loaded. Previously saved events are shown when available."
          title="Attendance events unavailable"
        />
      ) : null}
      {!events.isLoading && !events.isError && eventItems.length === 0 ? (
        <EmptyState
          description={capabilities.data?.canManageJummahAttendanceEvents === true ? "Create an event with its check-in window and Masjid location." : "There are no Jummah attendance events available."}
          title="No events available"
        />
      ) : null}

      <View style={styles.eventList}>
        {eventItems.map(({ event, fromCache }) => {
          const localItem = localByEvent.get(event.eventId);
          return (
            <EventCard
              key={event.eventId}
              canRecord={capabilities.data?.canRecordSelfJummahAttendance === true}
              errorCode={localItem?.errorCode}
              event={event}
              localStatus={localItem?.status}
              onRecord={(eventId) => record.mutate(eventId)}
              pending={record.isPending || sync.isPending || activeOperationId !== null}
            />
          );
        })}
      </View>

      {events.hasNextPage ? (
        <AppButton disabled={events.isFetchingNextPage} label={events.isFetchingNextPage ? "Loading..." : "Load older events"} onPress={() => void events.fetchNextPage()} variant="secondary" />
      ) : null}
    </Screen>
  );
}

function EventCard({ event, canRecord, localStatus, errorCode, onRecord, pending }: EventCardProps) {
  const windowOpen = event.isOpen;
  const recorded = Boolean(event.myAttendanceRecordedAt) || localStatus === "applied";
  const queued = !recorded && localStatus === "queued";
  const rejected = !recorded && localStatus === "rejected";
  const closesAt = new Date(event.checkinClosesAt).toLocaleString();

  return (
    <InformationCard style={styles.eventCard}>
      <View style={styles.eventHeading}>
        <View style={styles.eventIcon}><AppIcon color={colors.primaryBlue} name="calendar-check-outline" size={22} /></View>
        <View style={styles.eventCopy}>
          <Text style={styles.eventTitle}>Jummah</Text>
          <Text style={styles.eventDate}>{new Date(event.scheduledFor).toLocaleString()}</Text>
        </View>
        <StatusChip label={recorded ? "Recorded" : windowOpen ? "Check-in open" : "Not open"} tone={recorded ? "success" : windowOpen ? "info" : "neutral"} />
      </View>
      <View style={styles.windowRow}>
        <AppIcon color={colors.textMuted} name="clock-outline" size={17} />
        <Text style={styles.windowCopy}>Check-in closes {closesAt}</Text>
      </View>
      {queued ? <Text style={styles.pendingCopy}>Saved securely on this device; awaiting server confirmation.</Text> : null}
      {rejected ? <Text style={styles.rejectedCopy}>{errorCode === "attendance_window_closed" ? "Server rejected this attempt because the event window had closed." : "Server could not confirm this attendance attempt. You may try again while check-in is open."}</Text> : null}
      {!recorded && !queued && canRecord && windowOpen ? (
        <AppButton disabled={pending} label={pending ? "Checking location..." : "Record my attendance"} onPress={() => onRecord(event.eventId)} />
      ) : null}
      {!recorded && !queued && canRecord && !windowOpen ? (
        <Text style={styles.closedCopy}>Attendance can be submitted only during the event check-in window.</Text>
      ) : null}
    </InformationCard>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xl, paddingBottom: spacing.section },
  state: { flex: 1, justifyContent: "center", padding: spacing.xl },
  offlineNotice: { alignItems: "center", backgroundColor: colors.yellowSurface, borderColor: colors.warning, borderRadius: radii.card, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  offlineCopy: { color: colors.textStrong, flex: 1, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19 },
  syncNotice: { alignItems: "center", backgroundColor: colors.blueSurface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, padding: spacing.md },
  syncCopy: { flex: 1, minWidth: 170 },
  syncTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 14 },
  syncDescription: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  eventList: { gap: spacing.md },
  eventCard: { gap: spacing.md, padding: spacing.lg },
  eventHeading: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  eventIcon: { alignItems: "center", backgroundColor: colors.blueSurface, borderRadius: 12, height: 44, justifyContent: "center", width: 44 },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 16 },
  eventDate: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },
  windowRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
  windowCopy: { color: colors.textMuted, flex: 1, fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 18 },
  pendingCopy: { color: colors.warning, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19 },
  rejectedCopy: { color: colors.dangerRed, fontFamily: fontFamilies.medium, fontSize: 13, lineHeight: 19 },
  closedCopy: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 13, lineHeight: 19 },
});
