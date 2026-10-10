import { useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../src/auth/AuthProvider";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  InformationCard,
  LoadingState,
  SectionHeader,
  StatusChip,
} from "../../src/components/InstitutionalUI";
import { FormTextInput, Screen } from "../../src/components/Screen";
import {
  announcementListQueryKey,
  listMyAnnouncements,
  publishAnnouncement,
} from "../../src/modules/announcements";
import { loadCapabilities } from "../../src/modules/capabilities";
import { notificationInvalidationKeys } from "../../src/modules/notifications";
import { colors } from "../../src/theme/colors";
import { borders, radii, spacing, typography } from "../../src/theme/tokens";

export default function AnnouncementsScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canManage = capabilities.data?.canManageAnnouncements === true;
  const announcements = useQuery({
    queryKey: announcementListQueryKey(account?.id),
    queryFn: listMyAnnouncements,
    enabled: Boolean(account),
  });
  const publish = useMutation({
    mutationFn: () => publishAnnouncement({ title, body }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: announcementListQueryKey(account?.id) }),
        ...(account
          ? notificationInvalidationKeys(account.id).map((queryKey) =>
              queryClient.invalidateQueries({ queryKey }),
            )
          : []),
      ]);
    },
    onError: () => Alert.alert("Announcement not published", "Check the content and try again."),
  });

  if (!account || capabilities.isLoading)
    return (
      <Screen contentContainerStyle={styles.state}>
        <LoadingState label="Loading announcements" />
      </Screen>
    );

  const valid =
    title.trim().length > 0 &&
    title.trim().length <= 120 &&
    body.trim().length > 0 &&
    body.trim().length <= 2000;
  return (
    <Screen
      contentContainerStyle={styles.content}
      keyboardAware
      scroll
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={announcements.isRefetching}
            onRefresh={() => void announcements.refetch()}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <BrandedPageHeader
        eyebrow="Organization updates"
        title="Announcements"
        description={
          canManage
            ? "Publish a durable update to every active account with notification access."
            : "Important announcements shared with your account."
        }
      />
      {canManage ? (
        <View style={styles.section}>
          <SectionHeader
            title="New announcement"
            description="Recipients receive this in their personal notifications."
          />
          <InformationCard style={styles.form}>
            <FormTextInput
              accessibilityLabel="Announcement title"
              maxLength={120}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={title}
            />
            <FormTextInput
              accessibilityLabel="Announcement message"
              maxLength={2000}
              multiline
              onChangeText={setBody}
              placeholder="Message"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.multiline]}
              textAlignVertical="top"
              value={body}
            />
            <AppButton
              disabled={!valid || publish.isPending}
              label="Publish announcement"
              loading={publish.isPending}
              onPress={() => publish.mutate()}
            />
          </InformationCard>
        </View>
      ) : null}
      <View style={styles.section}>
        <SectionHeader title="Recent announcements" />
        {announcements.isLoading ? <LoadingState label="Loading announcements" /> : null}
        {announcements.isError ? (
          <ErrorState title="Announcements unavailable" description="Refresh to try again." />
        ) : null}
        {!announcements.isLoading &&
        !announcements.isError &&
        (announcements.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No announcements"
            description="Published announcements will appear here."
          />
        ) : null}
        {announcements.data?.map((item) => (
          <InformationCard key={item.id} style={styles.announcementCard}>
            <View style={styles.cardHeading}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <StatusChip label="Published" tone="info" />
            </View>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleString()}</Text>
          </InformationCard>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  state: { flex: 1, justifyContent: "center", padding: spacing.xl },
  section: { gap: spacing.md, marginTop: spacing.section },
  form: { gap: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: borders.width,
    color: colors.text,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
  },
  multiline: { minHeight: 132 },
  announcementCard: { gap: spacing.md },
  cardHeading: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cardTitle: { color: colors.textStrong, flex: 1, ...typography.cardTitle },
  cardBody: { color: colors.text, ...typography.body },
  cardDate: { color: colors.textMuted, ...typography.caption },
});
