import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { useAuth } from "../../src/auth/AuthProvider";
import { AppIcon, type AppIconName } from "../../src/components/AppIcon";
import { AppText as Text } from "../../src/components/AppText";
import {
  AppButton,
  BrandedPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../src/components/InstitutionalUI";
import { Screen } from "../../src/components/Screen";
import { loadCapabilities } from "../../src/modules/capabilities";
import { moreMobileModules, type MobileModuleKey } from "../../src/modules/mobile-navigation";
import { colors } from "../../src/theme/colors";
import { fontFamilies, radii, spacing } from "../../src/theme/tokens";

const modulePresentation: Partial<Record<MobileModuleKey, {
  background: string;
  color: string;
  icon: AppIconName;
}>> = {
  community: { background: colors.greenSurface, color: colors.successText, icon: "account-group-outline" },
  accounts: { background: colors.blueSurface, color: colors.primaryActionBlue, icon: "account-cog-outline" },
  donations: { background: colors.greenSurface, color: colors.successText, icon: "hand-heart-outline" },
  attendance: { background: colors.blueSurface, color: colors.primaryActionBlue, icon: "map-marker-check-outline" },
  finance: { background: colors.blueSurface, color: colors.primaryActionBlue, icon: "bank-outline" },
  notifications: { background: colors.yellowSurface, color: colors.warning, icon: "bell-outline" },
  profile: { background: colors.purpleSurface, color: colors.purple, icon: "account-circle-outline" },
  announcements: { background: colors.yellowSurface, color: colors.warning, icon: "bullhorn-outline" },
};

export default function MoreScreen() {
  const { account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  if (!account || capabilities.isLoading) {
    return <Screen contentContainerStyle={styles.state}><LoadingState label="Loading your workspace" /></Screen>;
  }
  if (capabilities.isError) {
    return (
      <Screen contentContainerStyle={styles.state}>
        <ErrorState
          action={<AppButton label="Retry" onPress={() => void capabilities.refetch()} variant="secondary" />}
          description="Your additional tools could not be loaded."
          title="Workspace unavailable"
        />
      </Screen>
    );
  }

  const modules = capabilities.data ? moreMobileModules(account.role, capabilities.data) : [];

  return (
    <Screen contentContainerStyle={styles.content} scroll>
      <BrandedPageHeader
        description="Additional tools available to your account."
        title="More"
      />
      <Pressable accessibilityLabel="Member activity" accessibilityRole="button"
        onPress={() => router.push("/activity")}
        style={({ pressed }) => [styles.moduleRow, styles.activityLink, pressed && styles.pressed]}>
        <View style={[styles.iconTile, { backgroundColor: colors.greenSurface }]}>
          <AppIcon color={colors.successText} name="account-group-outline" size={22} />
        </View>
        <View style={styles.moduleCopy}>
          <Text style={styles.moduleTitle}>Member activity</Text>
          <Text style={styles.moduleDescription}>Tasks, meetings, and verified referral contributions.</Text>
        </View>
        <AppIcon color={colors.textMuted} name="chevron-right" size={22} />
      </Pressable>
      <View style={styles.workspaceSection}>
        <View style={styles.sectionHeader}>
          <AppIcon color={colors.primaryBlue} name="view-grid-outline" size={21} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>Your workspace</Text>
        </View>
        {modules.length === 0 ? (
          <EmptyState
            description="Your primary navigation already contains every available module."
            title="No additional tools"
          />
        ) : (
          <View style={styles.moduleRows}>
            {modules.map((module) => {
              const presentation = modulePresentation[module.key] ?? {
                background: colors.blueSurface,
                color: colors.primaryActionBlue,
                icon: "view-grid-outline" as const,
              };
              return (
                <Pressable
                  accessibilityLabel={module.label}
                  accessibilityRole="button"
                  key={module.key}
                  onPress={() => router.push(module.href)}
                  style={({ pressed }) => [styles.moduleRow, pressed && styles.pressed]}
                >
                  <View style={[styles.iconTile, { backgroundColor: presentation.background }]}>
                    <AppIcon color={presentation.color} name={presentation.icon} size={22} />
                  </View>
                  <View style={styles.moduleCopy}>
                    <Text style={styles.moduleTitle}>{module.label}</Text>
                    <Text numberOfLines={2} style={styles.moduleDescription}>{module.description}</Text>
                  </View>
                  <AppIcon color={colors.textMuted} name="chevron-right" size={22} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  workspaceSection: { backgroundColor: colors.blueSurface, borderColor: "#D8E8FA", borderRadius: radii.card, borderWidth: 1, marginTop: spacing.xl, padding: spacing.md },
  sectionHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 17 },
  moduleRows: { gap: spacing.sm },
  activityLink: { marginTop: spacing.xl },
  moduleRow: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.border, borderRadius: radii.control, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 72, padding: spacing.md },
  iconTile: { alignItems: "center", borderRadius: 12, height: 44, justifyContent: "center", width: 44 },
  moduleCopy: { flex: 1 },
  moduleTitle: { color: colors.textStrong, fontFamily: fontFamilies.semibold, fontSize: 15, lineHeight: 20 },
  moduleDescription: { color: colors.textMuted, fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  pressed: { opacity: 0.7 },
  state: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
