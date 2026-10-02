import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../../src/auth/AuthProvider";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import { changeMemberStatus, getMember, updateMember } from "../../../../src/modules/data";
import { colors } from "../../../../src/theme/colors";
import { FormTextInput, Screen } from "../../../../src/components/Screen";

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const memberId = Array.isArray(id) ? id[0] : id;
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const member = useQuery({
    queryKey: ["member", memberId],
    queryFn: () => getMember(memberId),
    enabled: Boolean(memberId) && capabilities.data?.canReadMembers === true,
  });

  if (capabilities.isLoading) {
    return <View style={styles.state}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.stateText}>Loading member...</Text></View>;
  }
  if (!capabilities.data?.canReadMembers) return <AccessState />;
  if (member.isLoading) {
    return <View style={styles.state}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.stateText}>Loading member...</Text></View>;
  }
  if (member.isError || !member.data) {
    return <View style={styles.state}><Text style={styles.stateTitle}>Member unavailable</Text><Text style={styles.stateText}>This member could not be loaded.</Text><Pressable onPress={() => void member.refetch()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>;
  }

  const canEdit = capabilities.data?.canUpdateMembers === true;
  const currentMember = member.data;

  return (
    <Screen
      contentContainerStyle={styles.content}
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
      scrollViewProps={{
        refreshControl: <RefreshControl refreshing={member.isRefetching} onRefresh={() => void member.refetch()} tintColor={colors.deepEmerald} />,
      }}
    >
      <Text style={styles.eyebrow}>MEMBER DETAIL</Text>
      <Text style={styles.title}>{currentMember.displayName}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={[styles.status, currentMember.status === "inactive" && styles.inactive]}>{currentMember.status === "active" ? "Active" : "Inactive"}</Text>
        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>{currentMember.phone ?? "No phone provided"}</Text>
        <Text style={styles.label}>Created</Text>
        <Text style={styles.value}>{new Date(currentMember.createdAt).toLocaleDateString()}</Text>
        <Text style={styles.label}>Updated</Text>
        <Text style={styles.value}>{new Date(currentMember.updatedAt).toLocaleDateString()}</Text>
      </View>
      {canEdit ? (
        <MemberEditor
          member={currentMember}
          onRefresh={async () => {
            await Promise.all([
              member.refetch(),
              queryClient.invalidateQueries({ queryKey: ["members"] }),
            ]);
          }}
        />
      ) : null}
    </Screen>
  );
}

function AccessState() {
  return <View style={styles.state}><Text style={styles.stateTitle}>Members unavailable</Text><Text style={styles.stateText}>This member directory is not available for your account.</Text></View>;
}

function MemberEditor({
  member,
  onRefresh,
}: {
  member: NonNullable<Awaited<ReturnType<typeof getMember>>>;
  onRefresh: () => Promise<unknown>;
}) {
  const [displayName, setDisplayName] = useState(member.displayName);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    try {
      await updateMember({
        memberProfileId: member.id,
        displayName,
        phone: phone.trim() || null,
        reason: reason.trim() || null,
      });
      await onRefresh();
      setReason("");
    } catch {
      Alert.alert("Could not save", "Review the member details and try again.");
    } finally {
      setSaving(false);
    }
  }

  function confirmStatusChange() {
    const nextStatus = member.status === "active" ? "inactive" : "active";
    const action = nextStatus === "inactive" ? "deactivate" : "activate";
    Alert.alert(
      `${action[0].toUpperCase()}${action.slice(1)} member?`,
      `This will mark ${member.displayName} as ${nextStatus}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: action[0].toUpperCase() + action.slice(1), onPress: () => void saveStatus(nextStatus) },
      ],
    );
  }

  async function saveStatus(status: "active" | "inactive") {
    if (saving) return;
    setSaving(true);
    try {
      await changeMemberStatus(member.id, status, reason.trim() || null);
      await onRefresh();
      setReason("");
    } catch {
      Alert.alert("Could not update status", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Edit member</Text>
      <Text style={styles.label}>Display name</Text>
      <FormTextInput onChangeText={setDisplayName} style={styles.input} value={displayName} />
      <Text style={styles.label}>Phone</Text>
      <FormTextInput autoCapitalize="none" keyboardType="phone-pad" onChangeText={setPhone} style={styles.input} value={phone} />
      <Text style={styles.label}>Reason (optional)</Text>
      <FormTextInput onChangeText={setReason} multiline style={[styles.input, styles.reason]} value={reason} />
      <Pressable disabled={saving} onPress={() => void saveProfile()} style={styles.primaryButton}><Text style={styles.primaryText}>{saving ? "Saving..." : "Save changes"}</Text></Pressable>
      <Pressable disabled={saving} onPress={confirmStatusChange} style={styles.secondaryButton}><Text style={styles.secondaryText}>{member.status === "active" ? "Deactivate member" : "Activate member"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: colors.ivory, flexGrow: 1, padding: 20 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, marginTop: 20, padding: 18 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 4 },
  label: { color: colors.secondary, fontSize: 12, fontWeight: "700", marginTop: 14 },
  value: { color: colors.text, fontSize: 16, marginTop: 4 },
  status: { color: colors.success, fontSize: 16, fontWeight: "700", marginTop: 4 },
  inactive: { color: colors.danger },
  input: { borderColor: "#D8DED8", borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, height: 48, marginTop: 7, paddingHorizontal: 12 },
  reason: { height: 78, paddingTop: 12, textAlignVertical: "top" },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 50, justifyContent: "center", marginTop: 20 },
  primaryText: { color: colors.surface, fontWeight: "700" },
  secondaryButton: { alignItems: "center", borderColor: colors.danger, borderRadius: 10, borderWidth: 1, height: 48, justifyContent: "center", marginTop: 10 },
  secondaryText: { color: colors.danger, fontWeight: "700" },
  state: { alignItems: "center", backgroundColor: colors.ivory, flex: 1, justifyContent: "center", padding: 24 },
  stateTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  stateText: { color: colors.secondary, marginTop: 8, textAlign: "center" },
  retry: { backgroundColor: colors.deepEmerald, borderRadius: 9, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: colors.surface, fontWeight: "700" },
});
