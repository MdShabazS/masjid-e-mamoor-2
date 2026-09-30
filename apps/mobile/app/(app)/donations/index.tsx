import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DonationPaymentMethod } from "@masjid-e-mamoor/types";
import { useAuth } from "../../../src/auth/AuthProvider";
import { loadCapabilities } from "../../../src/modules/capabilities";
import {
  createAdditionalDonation,
  getDonationOutstandingSnapshot,
  listAdditionalDonations,
  listDonationAllocations,
  listDonationPayments,
  listDonationProofs,
  submitDonationPayment,
} from "../../../src/modules/donations";
import {
  formatDonationDate,
  formatDonationMonth,
  formatPaise,
  obligationStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "../../../src/modules/donation-presentation";
import { colors } from "../../../src/theme/colors";

const methods: DonationPaymentMethod[] = ["upi", "cash", "bank_transfer", "other"];

export default function DonationsScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<DonationPaymentMethod>("upi");
  const [additionalAmount, setAdditionalAmount] = useState("");
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canRead = capabilities.data?.canReadDonations === true;
  const snapshot = useQuery({
    queryKey: ["donations", "outstanding", account?.id],
    queryFn: getDonationOutstandingSnapshot,
    enabled: canRead,
  });
  const payments = useQuery({
    queryKey: ["donations", "payments", account?.id],
    queryFn: listDonationPayments,
    enabled: canRead,
  });
  const allocations = useQuery({
    queryKey: ["donations", "allocations", account?.id],
    queryFn: () => listDonationAllocations(),
    enabled: canRead,
  });
  const proofs = useQuery({
    queryKey: ["donations", "proofs", account?.id],
    queryFn: () => listDonationProofs(),
    enabled: canRead,
  });
  const additional = useQuery({
    queryKey: ["donations", "additional", account?.id],
    queryFn: listAdditionalDonations,
    enabled: canRead,
  });

  const refresh = async () => {
    await Promise.all([
      snapshot.refetch(),
      payments.refetch(),
      allocations.refetch(),
      proofs.refetch(),
      additional.refetch(),
    ]);
  };

  const refreshDonationData = () =>
    queryClient.invalidateQueries({ queryKey: ["donations"] });

  const submit = useMutation({
    mutationFn: () => submitDonationPayment(paymentAmount, paymentMethod),
    onSuccess: async () => {
      setPaymentAmount("");
      await refreshDonationData();
      Alert.alert("Payment submitted", "The payment is pending authorized review.");
    },
    onError: () => Alert.alert("Payment could not be submitted", "Check the amount and try again."),
  });
  const createAdditional = useMutation({
    mutationFn: () => createAdditionalDonation(additionalAmount),
    onSuccess: async () => {
      setAdditionalAmount("");
      await refreshDonationData();
      Alert.alert("Donation recorded", "Your additional donation has been recorded.");
    },
    onError: () => Alert.alert("Donation could not be recorded", "Check the amount and try again."),
  });
  const allocationTotalsByPayment = useMemo(() => {
    const totals = new Map<string, number>();
    for (const allocation of allocations.data ?? []) {
      totals.set(
        allocation.paymentId,
        (totals.get(allocation.paymentId) ?? 0) + allocation.allocatedAmountPaise,
      );
    }
    return totals;
  }, [allocations.data]);
  const proofCountsByPayment = useMemo(() => {
    const counts = new Map<string, number>();
    for (const proof of proofs.data ?? []) {
      counts.set(proof.paymentId, (counts.get(proof.paymentId) ?? 0) + 1);
    }
    return counts;
  }, [proofs.data]);

  if (!account || capabilities.isLoading) return <LoadingState />;
  if (!canRead) return <AccessState />;

  const loading = snapshot.isLoading || payments.isLoading || allocations.isLoading || proofs.isLoading || additional.isLoading;
  const failed = snapshot.isError || payments.isError || allocations.isError || proofs.isError || additional.isError;
  const refreshing = snapshot.isRefetching || payments.isRefetching || allocations.isRefetching || proofs.isRefetching || additional.isRefetching;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.deepEmerald} />}
      >
        <Text style={styles.eyebrow}>DONATION V1</Text>
        <Text style={styles.title}>Donations</Text>
        <Text style={styles.intro}>Your obligations, payment submissions, and donation history.</Text>

        {capabilities.data?.canManageDonations ? (
          <Pressable onPress={() => router.push("/donations/manage")} style={styles.managementButton}>
            <View style={styles.flexCopy}>
              <Text style={styles.managementTitle}>Donation management</Text>
              <Text style={styles.managementCopy}>Open authorized review and recording workflows</Text>
            </View>
            <Text style={styles.managementArrow}>›</Text>
          </Pressable>
        ) : null}

        {loading ? <LoadingPanel /> : null}
        {failed ? <ErrorPanel onRetry={() => void refresh()} /> : null}

        {!loading && !failed && snapshot.data ? (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>TOTAL OUTSTANDING</Text>
              <Text style={styles.summaryAmount}>{formatPaise(snapshot.data.totalOutstandingPaise)}</Text>
              <Text style={styles.summaryMeta}>{snapshot.data.obligationCount} monthly obligation{snapshot.data.obligationCount === 1 ? "" : "s"}</Text>
            </View>

            <SectionTitle title="Monthly obligations" />
            {snapshot.data.obligations.length === 0 ? <EmptyPanel title="No obligations" copy="Monthly obligations will appear here when generated." /> : null}
            {snapshot.data.obligations.map((obligation) => (
              <View key={obligation.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{formatDonationMonth(obligation.effectiveMonth)}</Text>
                  <StatusBadge label={obligationStatusLabel(obligation.status)} success={obligation.status === "paid" || obligation.status === "waived"} />
                </View>
                <MoneyRow label="Authoritative amount" value={obligation.authoritativeAmountPaise} />
                <MoneyRow label="Allocated" value={obligation.allocatedAmountPaise} />
                <MoneyRow label="Waived" value={obligation.waivedAmountPaise} />
                <MoneyRow emphasized label="Outstanding" value={obligation.outstandingAmountPaise} />
              </View>
            ))}
          </>
        ) : null}

        {capabilities.data?.canSubmitPayment ? (
          <View style={styles.formSection}>
            <SectionTitle title="Submit payment" />
            <Text style={styles.help}>Payments remain pending until authorized verification.</Text>
            <Field label="Amount in rupees" value={paymentAmount} onChangeText={setPaymentAmount} placeholder="1000.00" keyboardType="decimal-pad" />
            <Text style={styles.fieldLabel}>Payment method</Text>
            <View style={styles.choiceRow}>
              {methods.map((method) => (
                <Pressable key={method} onPress={() => setPaymentMethod(method)} style={[styles.choice, paymentMethod === method && styles.choiceActive]}>
                  <Text style={[styles.choiceText, paymentMethod === method && styles.choiceTextActive]}>{paymentMethodLabel(method)}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton disabled={submit.isPending} label={submit.isPending ? "Submitting..." : "Submit payment"} onPress={() => submit.mutate()} />
          </View>
        ) : null}

        {capabilities.data?.canCreateAdditionalDonation ? (
          <View style={styles.formSection}>
            <SectionTitle title="Additional donation" />
            <Text style={styles.help}>Record a separate donation that is not a monthly obligation payment.</Text>
            <Field label="Amount in rupees" value={additionalAmount} onChangeText={setAdditionalAmount} placeholder="500.00" keyboardType="decimal-pad" />
            <PrimaryButton disabled={createAdditional.isPending} label={createAdditional.isPending ? "Recording..." : "Record donation"} onPress={() => createAdditional.mutate()} />
          </View>
        ) : null}

        <SectionTitle title="Payment history" />
        {!loading && !failed && payments.data?.length === 0 ? <EmptyPanel title="No payments" copy="Submitted payments will appear here." /> : null}
        {payments.data?.map((payment) => {
          const allocated = allocationTotalsByPayment.get(payment.id) ?? 0;
          const proofCount = proofCountsByPayment.get(payment.id) ?? 0;
          return (
            <Pressable
              key={payment.id}
              onPress={() => router.push({ pathname: "/donations/payment/[id]", params: { id: payment.id } })}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.paymentAmount}>{formatPaise(payment.amountPaise)}</Text>
                <StatusBadge label={paymentStatusLabel(payment.status)} success={payment.status === "verified"} danger={payment.status === "rejected"} />
              </View>
              <Text style={styles.meta}>{paymentMethodLabel(payment.paymentMethod)} · {formatDonationDate(payment.createdAt)}</Text>
              <Text style={styles.meta}>Allocated: {formatPaise(allocated)} · Proofs: {proofCount}</Text>
              {payment.rejectionReason ? <Text style={styles.rejection}>Reason: {payment.rejectionReason}</Text> : null}
              <Text style={styles.linkText}>View payment details</Text>
            </Pressable>
          );
        })}

        <SectionTitle title="Additional donation history" />
        {!loading && !failed && additional.data?.length === 0 ? <EmptyPanel title="No additional donations" copy="Additional, overpayment, anonymous, and Jummah records visible to you appear here." /> : null}
        {additional.data?.map((donation) => (
          <View key={donation.id} style={styles.compactRow}>
            <View>
              <Text style={styles.cardTitle}>{donation.donationKind.replaceAll("_", " ")}</Text>
              <Text style={styles.meta}>{formatDonationDate(donation.createdAt)}</Text>
            </View>
            <Text style={styles.rowAmount}>{formatPaise(donation.amountPaise)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) { return <Text style={styles.sectionTitle}>{title}</Text>; }
function MoneyRow({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) { return <View style={styles.moneyRow}><Text style={[styles.meta, emphasized && styles.emphasized]}>{label}</Text><Text style={[styles.moneyValue, emphasized && styles.emphasized]}>{formatPaise(value)}</Text></View>; }
function StatusBadge({ label, success = false, danger = false }: { label: string; success?: boolean; danger?: boolean }) { return <Text style={[styles.badge, success && styles.badgeSuccess, danger && styles.badgeDanger]}>{label}</Text>; }
function Field({ label, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "decimal-pad" }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor="#93A099" style={styles.input} /></View>; }
function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.primaryButton, disabled && styles.disabled]}><Text style={styles.primaryText}>{label}</Text></Pressable>; }
function LoadingState() { return <SafeAreaView style={styles.page}><View style={styles.centerState}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.stateCopy}>Loading donations...</Text></View></SafeAreaView>; }
function AccessState() { return <SafeAreaView style={styles.page}><View style={styles.content}><Text style={styles.eyebrow}>DONATION V1</Text><Text style={styles.title}>Donations</Text><Text style={styles.stateCopy}>Donation tools are not available for this account.</Text></View></SafeAreaView>; }
function LoadingPanel() { return <View style={styles.statePanel}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.stateCopy}>Loading donation records...</Text></View>; }
function ErrorPanel({ onRetry }: { onRetry: () => void }) { return <View style={styles.statePanel}><Text style={styles.stateTitle}>Donation records could not load</Text><Text style={styles.stateCopy}>Check your connection and try again.</Text><Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>; }
function EmptyPanel({ title, copy }: { title: string; copy: string }) { return <View style={styles.statePanel}><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateCopy}>{copy}</Text></View>; }

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 20, paddingBottom: 44 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginTop: 6 },
  managementButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 14, flexDirection: "row", marginTop: 20, padding: 18 },
  flexCopy: { flex: 1, paddingRight: 12 },
  managementTitle: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  managementCopy: { color: "#C8D7D0", fontSize: 13, lineHeight: 19, marginTop: 4 },
  managementArrow: { color: colors.gold, fontSize: 30 },
  summary: { backgroundColor: colors.darkEmerald, borderRadius: 16, marginTop: 20, padding: 20 },
  summaryLabel: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  summaryAmount: { color: colors.surface, fontSize: 30, fontWeight: "700", marginTop: 8 },
  summaryMeta: { color: "#C8D7D0", fontSize: 13, marginTop: 6 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700", marginTop: 28, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderColor: colors.sand, borderRadius: 14, borderWidth: 1, marginBottom: 10, padding: 16 },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  paymentAmount: { color: colors.text, fontSize: 20, fontWeight: "700" },
  badge: { backgroundColor: colors.sand, borderRadius: 999, color: colors.secondary, fontSize: 11, fontWeight: "700", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5 },
  badgeSuccess: { backgroundColor: "#E1F0E7", color: colors.success },
  badgeDanger: { backgroundColor: "#F7E4E2", color: colors.danger },
  moneyRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  moneyValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  emphasized: { color: colors.deepEmerald, fontWeight: "800" },
  formSection: { marginTop: 4 },
  help: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  field: { marginTop: 10 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 10 },
  input: { backgroundColor: colors.surface, borderColor: "#D9D3C6", borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { backgroundColor: colors.surface, borderColor: "#D9D3C6", borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  choiceActive: { backgroundColor: colors.deepEmerald, borderColor: colors.deepEmerald },
  choiceText: { color: colors.secondary, fontSize: 13, fontWeight: "600" },
  choiceTextActive: { color: colors.surface },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, marginTop: 14, paddingHorizontal: 16, paddingVertical: 14 },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  meta: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  rejection: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 8 },
  linkText: { color: colors.deepEmerald, fontSize: 13, fontWeight: "700", marginTop: 12 },
  compactRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.sand, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 8, padding: 15 },
  rowAmount: { color: colors.deepEmerald, fontSize: 15, fontWeight: "700" },
  centerState: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  statePanel: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, marginTop: 18, padding: 22 },
  stateTitle: { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateCopy: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retry: { marginTop: 14, padding: 8 },
  retryText: { color: colors.deepEmerald, fontWeight: "700" },
});
