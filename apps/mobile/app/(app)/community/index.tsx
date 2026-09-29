import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../src/auth/AuthProvider";
import { loadCapabilities } from "../../../src/modules/capabilities";
import { colors } from "../../../src/theme/colors";

export default function CommunityScreen() {
  const { account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  if (!account) return null;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>COMMUNITY</Text>
        <Text style={styles.title}>Community</Text>
        <Text style={styles.intro}>Open the workflows available within your authorized scope.</Text>
        {capabilities.isLoading ? <Text style={styles.state}>Loading available workflows...</Text> : null}
        {capabilities.data?.canReadMembers ? <ModuleCard title="Members" detail="Review member information within your authorized scope." onPress={() => router.push("/members")} /> : null}
        {capabilities.data?.canUseReferrals ? <ModuleCard title="Referrals" detail={capabilities.data.canManageReferrals ? "Review and manage onboarding requests." : "Create and track member referral onboarding."} onPress={() => router.push("/referrals")} /> : null}
        {!capabilities.isLoading && !capabilities.data?.canReadMembers && !capabilities.data?.canUseReferrals ? <Text style={styles.state}>No community workflows are available for this account.</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function ModuleCard({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.card}><View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDetail}>{detail}</Text></View><Text style={styles.arrow}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 24 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  card: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, flexDirection: "row", justifyContent: "space-between", marginTop: 16, padding: 18 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  cardDetail: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 6, maxWidth: 280 },
  arrow: { color: colors.gold, fontSize: 30 },
  state: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 28 },
});
