import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors, roleLabels } from "../../src/theme/colors";
import { loadCapabilities } from "../../src/modules/capabilities";
import { visibleWorkspaceModules } from "../../src/modules/presentation";

export default function HomeScreen() {
  const { account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  if (!account) return null;
  const visibleModules = capabilities.data ? visibleWorkspaceModules(capabilities.data) : ["profile"];

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.mark} />
          <Text style={styles.brand}>MASJID E MAMOOR 2</Text>
        </View>
        <Text style={styles.greeting}>Assalamu Alaikum</Text>
        <Text style={styles.title}>Masjid E Mamoor 2</Text>
        <Text style={styles.subtitle}>Management Overview</Text>
        <View style={styles.welcomePanel}>
          <Text style={styles.panelLabel}>SIGNED-IN ACCOUNT</Text>
          <Text style={styles.username}>{account.username ?? "Account"}</Text>
          <Text style={styles.role}>{roleLabels[account.role]}</Text>
        </View>
        <Text style={styles.sectionTitle}>Your workspace</Text>
        <Pressable onPress={() => router.push("/profile")} style={styles.module}>
          <View>
            <Text style={styles.moduleTitle}>My Profile</Text>
            <Text style={styles.moduleCopy}>Identity and account security</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
        {visibleModules.includes("members") ? (
          <Pressable onPress={() => router.push("/community/members")} style={styles.module}>
            <View>
              <Text style={styles.moduleTitle}>Members</Text>
              <Text style={styles.moduleCopy}>Authorized member directory</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ) : null}
        {visibleModules.includes("referrals") ? (
          <Pressable onPress={() => router.push("/community/referrals")} style={styles.module}>
            <View>
              <Text style={styles.moduleTitle}>Referrals</Text>
              <Text style={styles.moduleCopy}>
                {capabilities.data?.canManageReferrals
                  ? "Review and manage onboarding"
                  : "Create and track referrals"}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 24 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  mark: { backgroundColor: colors.gold, borderRadius: 5, height: 18, transform: [{ rotate: "45deg" }], width: 18 },
  brand: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  greeting: { color: colors.deepEmerald, fontSize: 16, fontWeight: "700", marginTop: 48 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  subtitle: { color: colors.secondary, fontSize: 16, marginTop: 5 },
  welcomePanel: { backgroundColor: colors.deepEmerald, borderRadius: 16, marginTop: 24, padding: 20 },
  panelLabel: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  username: { color: colors.surface, fontSize: 22, fontWeight: "700", marginTop: 10 },
  role: { color: "#C8D7D0", fontSize: 14, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 30 },
  module: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, flexDirection: "row", justifyContent: "space-between", marginTop: 12, padding: 18 },
  moduleTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  moduleCopy: { color: colors.secondary, fontSize: 13, marginTop: 5 },
  arrow: { color: colors.gold, fontSize: 30, fontWeight: "300" },
});
