import { useRef } from "react";
import { Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../../src/auth/AuthProvider";
import { AppButton, BrandedPageHeader, EmptyState, ErrorState, LoadingState } from "../../../src/components/InstitutionalUI";
import { JummahAttendanceEventForm } from "../../../src/components/JummahAttendanceEventForm";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  createJummahAttendanceEvent,
  createJummahAttendanceOperationId,
  jummahAttendanceEventDraftIdentity,
  jummahAttendanceQueryKey,
  type JummahAttendanceEventDraft,
} from "../../../src/modules/jummah-attendance";
import { spacing } from "../../../src/theme/tokens";

export default function CreateJummahAttendanceEventScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const operationId = useRef<string | null>(null);
  const operationIdentity = useRef<string | null>(null);
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const create = useMutation({
    mutationFn: (draft: JummahAttendanceEventDraft) => {
      const identity = jummahAttendanceEventDraftIdentity(draft);
      if (identity !== operationIdentity.current) {
        operationIdentity.current = identity;
        operationId.current = createJummahAttendanceOperationId();
      }
      return createJummahAttendanceEvent(draft, operationId.current!);
    },
    onSuccess: async () => {
      operationId.current = null;
      operationIdentity.current = null;
      await queryClient.invalidateQueries({ queryKey: jummahAttendanceQueryKey(account?.id) });
      router.replace("/attendance");
    },
    onError: (error) => {
      const copy = error instanceof Error && error.message === "invalid_event_window"
        ? "The check-in closing time must be after it opens."
        : "Check the event details and try again. The operation is safe to retry.";
      Alert.alert("Jummah event could not be created", copy);
    },
  });

  if (!account || capabilities.isLoading) {
    return <Screen contentContainerStyle={styles.state}><LoadingState label="Checking event access" /></Screen>;
  }
  if (capabilities.isError) {
    return (
      <Screen contentContainerStyle={styles.state}>
        <ErrorState
          action={<AppButton label="Retry" onPress={() => void capabilities.refetch()} variant="secondary" />}
          description="Attendance event access could not be checked."
          title="Attendance unavailable"
        />
      </Screen>
    );
  }
  if (capabilities.data?.canManageJummahAttendanceEvents !== true) {
    return (
      <Screen contentContainerStyle={styles.state}>
        <EmptyState description="Only an authorized President can configure Jummah attendance events." title="Event setup unavailable" />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content} keyboardAware scroll>
      <BrandedPageHeader
        description="Set the event schedule, check-in window, and Masjid attendance centre."
        eyebrow="Jummah attendance"
        title="Create event"
      />
      <JummahAttendanceEventForm
        onSubmit={(draft) => {
          if (!create.isPending) create.mutate(draft);
        }}
        pending={create.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  state: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
