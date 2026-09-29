import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { randomUUID } from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../src/auth/AuthProvider";
import {
  approveManagedReferral,
  listManagedReferrals,
  provisionManagedReferral,
  rejectManagedReferral,
} from "../../../src/lib/mobile-api";
import { getMobileConfig } from "../../../src/lib/config";
import { createReferral, listOwnReferrals } from "../../../src/modules/data";
import { loadCapabilities } from "../../../src/modules/capabilities";
import type { MobileReferral } from "../../../src/modules/types";
import { colors } from "../../../src/theme/colors";

const readableStatuses: Record<string, string> = {
  created: "Created",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

function referralStatus(status: string) {
  return readableStatuses[status] ?? status;
}

function referralUrl(code: string) {
  const { apiUrl } = getMobileConfig();
  return `${apiUrl.replace(/\/$/, "")}/join/${encodeURIComponent(code)}`;
}

export default function ReferralsScreen() {
  const { account, session } = useAuth();
  const queryClient = useQueryClient();
  const [credential, setCredential] = useState<{ referralId: string; password: string } | null>(null);
  const [provisioningReferral, setProvisioningReferral] = useState<MobileReferral | null>(null);
  const [provisionUsername, setProvisionUsername] = useState("");
  const [provisionPassword, setProvisionPassword] = useState("");
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const ownReferrals = useQuery({
    queryKey: ["referrals", "own", account?.id],
    queryFn: () => listOwnReferrals(account!.memberProfile!.id),
    enabled: capabilities.data?.canCreateReferral === true && Boolean(account?.memberProfile),
  });
  const managedReferrals = useQuery({
    queryKey: ["referrals", "managed", account?.id],
    queryFn: () => listManagedReferrals(session!),
    enabled: capabilities.data?.canManageReferrals === true && Boolean(session),
  });
  const create = useMutation({
    mutationFn: createReferral,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referrals", "own"] }),
  });
  const approve = useMutation({
    mutationFn: (referralId: string) => approveManagedReferral(session!, referralId, randomUUID()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referrals", "managed"] }),
  });
  const reject = useMutation({
    mutationFn: (referralId: string) => rejectManagedReferral(session!, referralId, randomUUID(), "Rejected by reviewer"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referrals", "managed"] }),
  });

  if (!account || capabilities.isLoading) return <LoadingState />;
  if (!capabilities.data?.canUseReferrals) return <AccessState />;

  const referrals = capabilities.data.canManageReferrals ? managedReferrals.data ?? [] : ownReferrals.data ?? [];
  const isLoading = capabilities.data.canManageReferrals ? managedReferrals.isLoading : ownReferrals.isLoading;
  const isError = capabilities.data.canManageReferrals ? managedReferrals.isError : ownReferrals.isError;
  const refetch = capabilities.data.canManageReferrals ? managedReferrals.refetch : ownReferrals.refetch;

  async function shareReferral(referral: MobileReferral) {
    await Share.share({ message: referralUrl(referral.referralCode), title: "Masjid E Mamoor 2 referral" });
  }

  function provision(referral: MobileReferral) {
    setProvisioningReferral(referral);
    setProvisionUsername("");
    setProvisionPassword("");
  }

  async function submitProvision() {
    if (!provisioningReferral || !provisionUsername.trim()) return;
    try {
      const result = await provisionManagedReferral(session!, {
        referralId: provisioningReferral.id,
        username: provisionUsername.trim(),
        ...(provisionPassword.trim() ? { password: provisionPassword } : {}),
        operationId: randomUUID(),
      });
      if (result.temporaryPassword) {
        setCredential({ referralId: provisioningReferral.id, password: result.temporaryPassword });
      }
      setProvisioningReferral(null);
      setProvisionUsername("");
      setProvisionPassword("");
      await queryClient.invalidateQueries({ queryKey: ["referrals", "managed"] });
    } catch {
      Alert.alert("Could not provision", "Confirm the referral is approved and try again.");
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={Boolean((capabilities.data.canManageReferrals ? managedReferrals : ownReferrals).isRefetching)} onRefresh={() => void refetch()} tintColor={colors.deepEmerald} />}
      >
        <Text style={styles.eyebrow}>MEMBERSHIP</Text>
        <Text style={styles.title}>{capabilities.data.canManageReferrals ? "Referral management" : "Referrals"}</Text>
        {capabilities.data.canManageReferrals ? (
          <Text style={styles.intro}>Review submitted onboarding requests and provision approved members.</Text>
        ) : null}
        {capabilities.data.canCreateReferral ? (
          <Pressable disabled={create.isPending} onPress={() => create.mutate()} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{create.isPending ? "Creating..." : "Create referral"}</Text>
          </Pressable>
        ) : null}
        {credential ? <CredentialPanel credential={credential} onCopy={() => void Clipboard.setStringAsync(credential.password)} onDismiss={() => setCredential(null)} /> : null}
        {provisioningReferral ? (
          <View style={styles.provisionForm}>
            <Text style={styles.cardTitle}>Provision approved referral</Text>
            <Text style={styles.meta}>A temporary password will be generated and shown once.</Text>
            <TextInput autoCapitalize="none" onChangeText={setProvisionUsername} placeholder="New member username" placeholderTextColor="#9EA9A3" style={styles.provisionInput} value={provisionUsername} />
            <TextInput autoCapitalize="none" onChangeText={setProvisionPassword} placeholder="Optional temporary password" placeholderTextColor="#9EA9A3" secureTextEntry style={styles.provisionInput} value={provisionPassword} />
            <View style={styles.actionRow}>
              <Pressable disabled={!provisionUsername.trim()} onPress={() => void submitProvision()} style={styles.primarySmall}><Text style={styles.primaryText}>Provision</Text></Pressable>
              <Pressable onPress={() => { setProvisioningReferral(null); setProvisionUsername(""); setProvisionPassword(""); }} style={styles.secondarySmall}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
            </View>
          </View>
        ) : null}
        {capabilities.data.canManageReferrals && capabilities.data.canCreateReferral ? <Text style={styles.sectionTitle}>My referrals</Text> : null}
        {capabilities.data.canManageReferrals && capabilities.data.canCreateReferral && ownReferrals.isLoading ? <LoadingState /> : null}
        {capabilities.data.canManageReferrals && capabilities.data.canCreateReferral && ownReferrals.isError ? <ErrorState onRetry={() => void ownReferrals.refetch()} /> : null}
        {capabilities.data.canManageReferrals && capabilities.data.canCreateReferral && !ownReferrals.isLoading && !ownReferrals.isError && ownReferrals.data?.length === 0 ? <EmptyState managed={false} /> : null}
        {capabilities.data.canManageReferrals && capabilities.data.canCreateReferral ? ownReferrals.data?.map((referral) => <ReferralCard key={referral.id} managed={false} referral={referral} busy={false} onShare={() => void shareReferral(referral)} onApprove={() => undefined} onReject={() => undefined} onProvision={() => undefined} />) : null}
        {capabilities.data.canManageReferrals ? <Text style={styles.sectionTitle}>Onboarding queue</Text> : null}
        {isLoading ? <LoadingState /> : null}
        {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
        {!isLoading && !isError && referrals.length === 0 ? <EmptyState managed={capabilities.data.canManageReferrals} /> : null}
        {referrals.map((referral) => <ReferralCard key={referral.id} managed={capabilities.data.canManageReferrals} referral={referral} busy={approve.isPending || reject.isPending} onShare={() => void shareReferral(referral)} onApprove={() => approve.mutate(referral.id)} onReject={() => reject.mutate(referral.id)} onProvision={() => void provision(referral)} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReferralCard({
  referral,
  managed,
  busy,
  onShare,
  onApprove,
  onReject,
  onProvision,
}: {
  referral: MobileReferral;
  managed: boolean;
  busy: boolean;
  onShare: () => void;
  onApprove: () => void;
  onReject: () => void;
  onProvision: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{referral.applicantDisplayName ?? "Referral link"}</Text>
        <Text style={[styles.badge, referral.status === "rejected" && styles.rejected, referral.status === "completed" && styles.completed]}>{referralStatus(referral.status)}</Text>
      </View>
      <Text style={styles.meta}>Created {new Date(referral.createdAt).toLocaleDateString()}</Text>
      {referral.applicantPhone ? <Text style={styles.meta}>{referral.applicantPhone}</Text> : null}
      {referral.reviewReason ? <Text style={styles.reason}>Reason: {referral.reviewReason}</Text> : null}
      {!managed && referral.status !== "completed" ? <Pressable onPress={onShare} style={styles.secondaryButton}><Text style={styles.secondaryText}>Share referral</Text></Pressable> : null}
      {managed && referral.status === "submitted" ? (
        <View style={styles.actionRow}>
          <Pressable disabled={busy} onPress={onApprove} style={styles.primarySmall}><Text style={styles.primaryText}>Approve</Text></Pressable>
          <Pressable disabled={busy} onPress={onReject} style={styles.rejectSmall}><Text style={styles.rejectText}>Reject</Text></Pressable>
        </View>
      ) : null}
      {managed && referral.status === "approved" ? <Pressable disabled={busy} onPress={onProvision} style={styles.primaryButton}><Text style={styles.primaryText}>Provision member</Text></Pressable> : null}
    </View>
  );
}

function CredentialPanel({ credential, onCopy, onDismiss }: { credential: { referralId: string; password: string }; onCopy: () => void; onDismiss: () => void }) {
  return <View style={styles.credential}><Text style={styles.credentialLabel}>TEMPORARY PASSWORD</Text><Text style={styles.credentialCopy}>Show this once to the new member. It will not be available after dismissal.</Text><Text selectable style={styles.password}>{credential.password}</Text><View style={styles.actionRow}><Pressable onPress={onCopy} style={styles.primarySmall}><Text style={styles.primaryText}>Copy</Text></Pressable><Pressable onPress={onDismiss} style={styles.secondarySmall}><Text style={styles.secondaryText}>Dismiss</Text></Pressable></View></View>;
}

function LoadingState() { return <View style={styles.state}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.stateText}>Loading referrals...</Text></View>; }
function AccessState() { return <SafeAreaView style={styles.page}><View style={styles.content}><Text style={styles.eyebrow}>MEMBERSHIP</Text><Text style={styles.title}>Referrals</Text><Text style={styles.stateText}>Referral tools are not available for your account.</Text></View></SafeAreaView>; }
function EmptyState({ managed }: { managed: boolean }) { return <View style={styles.state}><Text style={styles.stateTitle}>{managed ? "No onboarding requests" : "No referrals yet"}</Text><Text style={styles.stateText}>{managed ? "Submitted requests will appear here." : "Create a referral link when you are ready."}</Text></View>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <View style={styles.state}><Text style={styles.stateTitle}>Referrals could not load</Text><Text style={styles.stateText}>Check your connection and try again.</Text><Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>; }

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 20, paddingBottom: 36 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 29, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 24 },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 48, justifyContent: "center", marginTop: 20 },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderRadius: 14, marginTop: 14, padding: 16 },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: "700" },
  badge: { backgroundColor: "#F2EAD7", borderRadius: 20, color: "#876B28", fontSize: 11, fontWeight: "700", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5 },
  rejected: { backgroundColor: "#F4E5E3", color: colors.danger },
  completed: { backgroundColor: "#E1F0E6", color: colors.success },
  meta: { color: colors.secondary, fontSize: 13, marginTop: 8 },
  reason: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 10 },
  secondaryButton: { alignItems: "center", borderColor: colors.deepEmerald, borderRadius: 9, borderWidth: 1, height: 44, justifyContent: "center", marginTop: 14 },
  secondaryText: { color: colors.deepEmerald, fontSize: 14, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  primarySmall: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 9, flex: 1, height: 44, justifyContent: "center" },
  rejectSmall: { alignItems: "center", borderColor: colors.danger, borderRadius: 9, borderWidth: 1, flex: 1, height: 44, justifyContent: "center" },
  rejectText: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  secondarySmall: { alignItems: "center", borderColor: "#B9C6BE", borderRadius: 9, borderWidth: 1, flex: 1, height: 44, justifyContent: "center" },
  credential: { backgroundColor: colors.darkEmerald, borderRadius: 14, marginTop: 18, padding: 16 },
  provisionForm: { backgroundColor: colors.surface, borderRadius: 14, marginTop: 18, padding: 16 },
  provisionInput: { borderColor: "#D8DED8", borderRadius: 9, borderWidth: 1, color: colors.text, height: 46, marginTop: 14, paddingHorizontal: 12 },
  credentialLabel: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  credentialCopy: { color: "#C8D7D0", fontSize: 13, lineHeight: 19, marginTop: 8 },
  password: { color: colors.surface, fontSize: 20, fontWeight: "700", letterSpacing: 1, marginTop: 14 },
  state: { alignItems: "center", justifyContent: "center", minHeight: 180, padding: 24 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  stateText: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retry: { backgroundColor: colors.deepEmerald, borderRadius: 9, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: colors.surface, fontWeight: "700" },
});
