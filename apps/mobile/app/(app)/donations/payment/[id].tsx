import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../../src/auth/AuthProvider";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  createDonationProofSignedUrl,
  getDonationPayment,
  listDonationAllocations,
  listDonationProofs,
  uploadDonationPaymentProof,
} from "../../../../src/modules/donations";
import {
  formatDonationDate,
  formatPaise,
  paymentMethodLabel,
  paymentStatusLabel,
} from "../../../../src/modules/donation-presentation";
import { colors } from "../../../../src/theme/colors";

export default function DonationPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const paymentId = typeof id === "string" ? id : "";
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const payment = useQuery({
    queryKey: ["donations", "payment", account?.id, paymentId],
    queryFn: () => getDonationPayment(paymentId),
    enabled: Boolean(account && paymentId && capabilities.data?.canReadDonations),
  });
  const allocations = useQuery({
    queryKey: ["donations", "payment", paymentId, "allocations"],
    queryFn: () => listDonationAllocations(paymentId),
    enabled: Boolean(payment.data),
  });
  const proofs = useQuery({
    queryKey: ["donations", "payment", paymentId, "proofs"],
    queryFn: () => listDonationProofs(paymentId),
    enabled: Boolean(payment.data),
  });
  const upload = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return false;
      await uploadDonationPaymentProof(paymentId, result.assets[0]);
      return true;
    },
    onSuccess: async (uploaded) => {
      if (!uploaded) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["donations", "proofs"] }),
        queryClient.invalidateQueries({ queryKey: ["donations", "payment", paymentId, "proofs"] }),
      ]);
      Alert.alert("Proof attached", "The private payment proof is ready for authorized review.");
    },
    onError: () => Alert.alert("Payment proof could not be uploaded", "Choose a JPEG, PNG, or PDF up to 5 MiB and try again."),
  });

  const refresh = async () => {
    await Promise.all([payment.refetch(), allocations.refetch(), proofs.refetch()]);
  };

  async function viewProof(proofId: string) {
    try {
      const signedUrl = await createDonationProofSignedUrl(proofId);
      await Linking.openURL(signedUrl);
    } catch {
      Alert.alert("Proof unavailable", "This payment proof cannot be opened for this account.");
    }
  }

  if (capabilities.isLoading || payment.isLoading) return <State loading copy="Loading payment..." />;
  if (!capabilities.data?.canReadDonations || payment.isError || !payment.data) {
    return <State copy="This payment is not available for this account." onRetry={() => void payment.refetch()} />;
  }

  const allocatedAmount = allocations.data?.reduce((total, allocation) => total + allocation.allocatedAmountPaise, 0) ?? 0;
  const canAttach =
    capabilities.data.canUploadProof &&
    (payment.data.status === "submitted" || payment.data.status === "under_review") &&
    proofs.data?.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={payment.isRefetching || allocations.isRefetching || proofs.isRefetching} onRefresh={() => void refresh()} tintColor={colors.deepEmerald} />}
    >
      <Text style={styles.eyebrow}>PAYMENT</Text>
      <View style={styles.headingRow}>
        <Text style={styles.amount}>{formatPaise(payment.data.amountPaise)}</Text>
        <Text style={[styles.badge, payment.data.status === "verified" && styles.success, payment.data.status === "rejected" && styles.danger]}>{paymentStatusLabel(payment.data.status)}</Text>
      </View>
      <Text style={styles.meta}>{paymentMethodLabel(payment.data.paymentMethod)} · Submitted {formatDonationDate(payment.data.createdAt)}</Text>

      <View style={styles.card}>
        <Row label="Payment amount" value={formatPaise(payment.data.amountPaise)} />
        <Row label="Verified allocation" value={formatPaise(allocatedAmount)} />
        <Row label="Proofs attached" value={String(proofs.data?.length ?? 0)} />
        {payment.data.reviewedAt ? <Row label="Reviewed" value={formatDonationDate(payment.data.reviewedAt)} /> : null}
      </View>

      {payment.data.rejectionReason ? (
        <View style={styles.rejectionPanel}>
          <Text style={styles.rejectionTitle}>Payment rejected</Text>
          <Text style={styles.rejectionCopy}>{payment.data.rejectionReason}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Private payment proof</Text>
      {proofs.isLoading ? <ActivityIndicator color={colors.deepEmerald} /> : null}
      {proofs.isError ? <State copy="Payment proofs could not load." onRetry={() => void proofs.refetch()} compact /> : null}
      {proofs.data?.map((proof, index) => (
        <Pressable key={proof.id} onPress={() => void viewProof(proof.id)} style={styles.proofRow}>
          <View>
            <Text style={styles.proofTitle}>Payment proof {index + 1}</Text>
            <Text style={styles.meta}>{formatDonationDate(proof.createdAt)}</Text>
          </View>
          <Text style={styles.link}>View proof</Text>
        </Pressable>
      ))}
      {!proofs.isLoading && !proofs.isError && proofs.data?.length === 0 ? (
        <Text style={styles.emptyCopy}>No proof attached.</Text>
      ) : null}

      {canAttach ? (
        <Pressable disabled={upload.isPending} onPress={() => upload.mutate()} style={[styles.primaryButton, upload.isPending && styles.disabled]}>
          <Text style={styles.primaryText}>{upload.isPending ? "Uploading..." : "Attach payment proof"}</Text>
        </Pressable>
      ) : null}
      {canAttach ? <Text style={styles.help}>JPEG, PNG, or PDF. Maximum 5 MiB.</Text> : null}
      {proofs.data && proofs.data.length > 0 ? <Text style={styles.help}>An existing proof is already registered for this payment.</Text> : null}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }
function State({ copy, loading = false, onRetry, compact = false }: { copy: string; loading?: boolean; onRetry?: () => void; compact?: boolean }) { return <View style={[styles.state, compact && styles.compactState]}>{loading ? <ActivityIndicator color={colors.deepEmerald} /> : null}<Text style={styles.stateCopy}>{copy}</Text>{onRetry ? <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.link}>Retry</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  content: { backgroundColor: colors.ivory, flexGrow: 1, padding: 20, paddingBottom: 44 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  headingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  amount: { color: colors.text, fontSize: 30, fontWeight: "700" },
  badge: { backgroundColor: colors.sand, borderRadius: 999, color: colors.secondary, fontSize: 11, fontWeight: "700", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6 },
  success: { backgroundColor: "#E1F0E7", color: colors.success },
  danger: { backgroundColor: "#F7E4E2", color: colors.danger },
  meta: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderColor: colors.sand, borderRadius: 14, borderWidth: 1, marginTop: 22, padding: 16 },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 38 },
  rowLabel: { color: colors.secondary, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  rejectionPanel: { backgroundColor: "#F7E4E2", borderRadius: 12, marginTop: 14, padding: 16 },
  rejectionTitle: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  rejectionCopy: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 6 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700", marginBottom: 10, marginTop: 28 },
  proofRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.sand, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 8, padding: 15 },
  proofTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  link: { color: colors.deepEmerald, fontSize: 13, fontWeight: "700" },
  emptyCopy: { color: colors.secondary, fontSize: 14, marginVertical: 8 },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, marginTop: 14, padding: 14 },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  help: { color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 },
  state: { alignItems: "center", backgroundColor: colors.ivory, flex: 1, justifyContent: "center", padding: 24 },
  compactState: { backgroundColor: colors.surface, borderRadius: 12, flex: 0, marginTop: 8 },
  stateCopy: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retry: { marginTop: 10, padding: 8 },
});
