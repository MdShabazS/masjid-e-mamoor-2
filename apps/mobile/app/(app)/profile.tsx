import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import type { MobileMemberProfile } from "../../src/auth/types";
import { updateOwnMemberProfile } from "../../src/modules/data";
import { colors, roleLabels } from "../../src/theme/colors";

export default function ProfileScreen() {
  const { account, refreshAccount, signOut } = useAuth();
  if (!account) return null;

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{account.username ?? "Not set"}</Text>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{roleLabels[account.role]}</Text>
          <Text style={styles.label}>Account status</Text>
          <Text style={[styles.value, styles.success]}>Active</Text>
          <Text style={styles.label}>Password status</Text>
          <Text style={styles.value}>{account.mustChangePassword ? "Change required" : "Up to date"}</Text>
        </View>
        {account.memberProfile ? <MemberProfileEditor profile={account.memberProfile} onSaved={() => void refreshAccount()} /> : <View style={styles.card}><Text style={styles.cardTitle}>Membership details</Text><Text style={styles.value}>Administrative account — no member membership record is attached.</Text></View>}
        <Pressable onPress={() => router.push("/(auth)/change-password")} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Change password</Text>
        </Pressable>
        <Pressable onPress={() => void signOut()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function MemberProfileEditor({ profile, onSaved }: { profile: MobileMemberProfile; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await updateOwnMemberProfile(displayName, phone.trim() || null);
      onSaved();
      Alert.alert("Profile updated", "Your membership details were saved.");
    } catch {
      Alert.alert("Could not save", "Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <View style={styles.card}><Text style={styles.cardTitle}>Membership details</Text><Text style={styles.label}>Display name</Text><TextInput onChangeText={setDisplayName} style={styles.input} value={displayName} /><Text style={styles.label}>Phone</Text><TextInput autoCapitalize="none" keyboardType="phone-pad" onChangeText={setPhone} style={styles.input} value={phone} /><Pressable disabled={saving} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{saving ? "Saving..." : "Save membership details"}</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 24 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, marginTop: 20, padding: 18 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  label: { color: colors.secondary, fontSize: 12, fontWeight: "700", marginTop: 14 },
  value: { color: colors.text, fontSize: 16, marginTop: 4 },
  input: { borderColor: "#D8DED8", borderRadius: 9, borderWidth: 1, color: colors.text, height: 48, marginTop: 7, paddingHorizontal: 12 },
  success: { color: colors.success, fontWeight: "700" },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 50, justifyContent: "center", marginTop: 22 },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  secondaryButton: { alignItems: "center", height: 48, justifyContent: "center", marginTop: 8 },
  secondaryButtonText: { color: colors.secondary, fontSize: 15, fontWeight: "700" },
});
