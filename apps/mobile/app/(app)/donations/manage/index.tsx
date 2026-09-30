import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DonationOutstandingSnapshot, DonationPayment } from "@masjid-e-mamoor/types";
import { useAuth } from "../../../../src/auth/AuthProvider";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  createAnonymousDonation,
  createDonationObligationRule,
  createDonationProofSignedUrl,
  createJummahCashDonation,
  generateMonthlyDonationObligations,
  getDonationOutstandingSnapshot,
  listDonationObligationRules,
  listDonationPayments,
  listDonationProofs,
  rejectDonationPayment,
  startDonationPaymentReview,
  verifyAndAllocateDonationPayment,
  waiveDonationObligation,
  type DonationPaymentProof,
} from "../../../../src/modules/donations";
import {
  formatDonationDate,
  formatDonationMonth,
  formatPaise,
  obligationStatusLabel,
  paymentMethodLabel,
  paymentStatusLabel,
} from "../../../../src/modules/donation-presentation";
import { colors } from "../../../../src/theme/colors";

export default function DonationManagementScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [waiver, setWaiver] = useState({ obligationId: "", amount: "", reason: "" });
  const [rule, setRule] = useState({ month: "", amount: "" });
  const [generationMonth, setGenerationMonth] = useState("");
  const [anonymousAmount, setAnonymousAmount] = useState("");
  const [jummahAmount, setJummahAmount] = useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const canManage = capabilities.data?.canManageDonations === true;
  const payments = useQuery({
    queryKey: ["donations", "management", "payments", account?.id],
    queryFn: listDonationPayments,
    enabled: canManage && capabilities.data?.canReviewPayments === true,
  });
  const proofs = useQuery({
    queryKey: ["donations", "management", "proofs", account?.id],
    queryFn: () => listDonationProofs(),
    enabled: canManage && capabilities.data?.canReviewPayments === true,
  });
  const snapshot = useQuery({
    queryKey: ["donations", "management", "outstanding", account?.id],
    queryFn: getDonationOutstandingSnapshot,
    enabled: canManage && capabilities.data?.canManageObligations === true,
  });
  const rules = useQuery({
    queryKey: ["donations", "management", "rules", account?.id],
    queryFn: listDonationObligationRules,
    enabled: canManage && capabilities.data?.canManageObligations === true,
  });

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: ["donations"] });
  const actionError = (title: string, copy: string) => () => Alert.alert(title, copy);
  const review = useMutation({
    mutationFn: startDonationPaymentReview,
    onSuccess: refreshAll,
    onError: actionError("Review could not start", "This payment can no longer be reviewed."),
  });
  const reject = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => rejectDonationPayment(paymentId, reason),
    onSuccess: async () => {
      setRejectingPaymentId(null);
      setRejectionReason("");
      await refreshAll();
    },
    onError: actionError("Payment could not be rejected", "Check the reason and payment state, then try again."),
  });
  const verify = useMutation({
    mutationFn: verifyAndAllocateDonationPayment,
    onSuccess: refreshAll,
    onError: actionError("Payment could not be verified", "This payment can no longer be verified."),
  });
  const waive = useMutation({
    mutationFn: () => waiveDonationObligation(waiver.obligationId, waiver.amount, waiver.reason),
    onSuccess: async () => {
      setWaiver({ obligationId: "", amount: "", reason: "" });
      await refreshAll();
      Alert.alert("Waiver recorded", "The authoritative obligation balance has been refreshed.");
    },
    onError: actionError("Obligation could not be updated", "Check the amount and reason, then try again."),
  });
  const createRule = useMutation({
    mutationFn: () => createDonationObligationRule(rule.month, rule.amount),
    onSuccess: async () => {
      setRule({ month: "", amount: "" });
      await refreshAll();
      Alert.alert("Rule created", "The monthly obligation rule is now available.");
    },
    onError: actionError("Rule could not be created", "Use a valid YYYY-MM month and positive amount."),
  });
  const generate = useMutation({
    mutationFn: () => generateMonthlyDonationObligations(generationMonth),
    onSuccess: async (result) => {
      setGenerationMonth("");
      await refreshAll();
      Alert.alert("Obligations generated", `${result.createdCount} obligation${result.createdCount === 1 ? "" : "s"} created.`);
    },
    onError: actionError("Obligations could not be generated", "Use a valid month with an applicable rule."),
  });
  const anonymous = useMutation({
    mutationFn: () => createAnonymousDonation(anonymousAmount),
    onSuccess: async () => {
      setAnonymousAmount("");
      await refreshAll();
      Alert.alert("Anonymous donation recorded", "The staff operation remains auditable.");
    },
    onError: actionError("Donation could not be recorded", "Check the amount and try again."),
  });
  const jummah = useMutation({
    mutationFn: () => createJummahCashDonation(jummahAmount),
    onSuccess: async () => {
      setJummahAmount("");
      await refreshAll();
      Alert.alert("Jummah cash recorded", "The collection has been recorded separately from member obligations.");
    },
    onError: actionError("Jummah cash could not be recorded", "Check the amount and try again."),
  });
  const proofsByPayment = useMemo(() => {
    const grouped = new Map<string, DonationPaymentProof[]>();
    for (const proof of proofs.data ?? []) {
      grouped.set(proof.paymentId, [...(grouped.get(proof.paymentId) ?? []), proof]);
    }
    return grouped;
  }, [proofs.data]);

  async function refresh() {
    const requests: Promise<unknown>[] = [];
    if (capabilities.data?.canReviewPayments) {
      requests.push(payments.refetch(), proofs.refetch());
    }
    if (capabilities.data?.canManageObligations) {
      requests.push(snapshot.refetch(), rules.refetch());
    }
    await Promise.all(requests);
  }

  async function viewProof(proofId: string) {
    try {
      await Linking.openURL(await createDonationProofSignedUrl(proofId));
    } catch {
      Alert.alert("Proof unavailable", "This payment proof cannot be opened for this account.");
    }
  }

  function confirmVerify(payment: DonationPayment) {
    Alert.alert(
      "Verify and allocate payment?",
      `Verify ${formatPaise(payment.amountPaise)} and apply the backend allocation rules?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Verify and allocate", onPress: () => verify.mutate(payment.id) },
      ],
    );
  }

  function confirmWaiver(obligation: DonationOutstandingSnapshot["obligations"][number]) {
    if (!waiver.amount.trim() || !waiver.reason.trim()) {
      Alert.alert("Waiver details required", "Enter a positive amount and a reason.");
      return;
    }
    Alert.alert(
      "Record obligation waiver?",
      `Current authoritative outstanding amount: ${formatPaise(obligation.outstandingAmountPaise)}. The database will validate the waiver.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Record waiver", onPress: () => waive.mutate() },
      ],
    );
  }

  if (!account || capabilities.isLoading) return <PageState loading copy="Loading donation management..." />;
  const resolvedCapabilities = capabilities.data;
  if (!canManage || !resolvedCapabilities) return <PageState copy="Donation management is not available for this account." />;

  const reviewQueue = payments.data?.filter((payment) => payment.status === "submitted" || payment.status === "under_review") ?? [];
  const refreshing = payments.isRefetching || proofs.isRefetching || snapshot.isRefetching || rules.isRefetching;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.deepEmerald} />}
    >
      <Text style={styles.eyebrow}>AUTHORIZED WORKFLOWS</Text>
      <Text style={styles.title}>Donation management</Text>
      <Text style={styles.intro}>Only sections granted to this account are shown. All decisions remain server-authoritative.</Text>

      {resolvedCapabilities.canReviewPayments ? (
        <Section title="Payment review" copy="Inspect proof and payment state before deciding.">
          {payments.isLoading || proofs.isLoading ? <LoadingLine /> : null}
          {payments.isError || proofs.isError ? <InlineError onRetry={() => void refresh()} /> : null}
          {!payments.isLoading && !payments.isError && reviewQueue.length === 0 ? <EmptyLine copy="No payments are waiting for review." /> : null}
          {reviewQueue.map((payment) => {
            const paymentProofs = proofsByPayment.get(payment.id) ?? [];
            return (
              <View key={payment.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardAmount}>{formatPaise(payment.amountPaise)}</Text>
                  <Text style={styles.badge}>{paymentStatusLabel(payment.status)}</Text>
                </View>
                <Text style={styles.meta}>{paymentMethodLabel(payment.paymentMethod)} · {formatDonationDate(payment.createdAt)}</Text>
                {paymentProofs.length === 0 ? <Text style={styles.noProof}>No proof attached.</Text> : null}
                {paymentProofs.map((proof, index) => (
                  <Pressable key={proof.id} onPress={() => void viewProof(proof.id)} style={styles.proofButton}>
                    <Text style={styles.secondaryButtonText}>View proof {index + 1}</Text>
                  </Pressable>
                ))}
                {rejectingPaymentId === payment.id ? (
                  <View style={styles.inlineForm}>
                    <Field label="Rejection reason" value={rejectionReason} onChangeText={setRejectionReason} placeholder="Required reason" multiline maxLength={1000} />
                    <View style={styles.actionRow}>
                      <ActionButton danger disabled={reject.isPending} label={reject.isPending ? "Rejecting..." : "Confirm rejection"} onPress={() => reject.mutate({ paymentId: payment.id, reason: rejectionReason })} />
                      <ActionButton secondary label="Cancel" onPress={() => { setRejectingPaymentId(null); setRejectionReason(""); }} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    {payment.status === "submitted" ? <ActionButton disabled={review.isPending} label="Start review" onPress={() => review.mutate(payment.id)} /> : null}
                    {payment.status === "under_review" && resolvedCapabilities.canVerifyAndAllocatePayments ? <ActionButton disabled={verify.isPending} label="Verify + allocate" onPress={() => confirmVerify(payment)} /> : null}
                    <ActionButton danger label="Reject" onPress={() => { setRejectingPaymentId(payment.id); setRejectionReason(""); }} />
                  </View>
                )}
              </View>
            );
          })}
        </Section>
      ) : null}

      {resolvedCapabilities.canManageObligations ? (
        <>
          <Section title="Obligation waivers" copy="Choose an obligation and compare against its authoritative outstanding amount.">
            {snapshot.isLoading ? <LoadingLine /> : null}
            {snapshot.isError ? <InlineError onRetry={() => void snapshot.refetch()} /> : null}
            {snapshot.data?.obligations.filter((item) => item.outstandingAmountPaise > 0).map((obligation) => (
              <Pressable
                key={obligation.id}
                onPress={() => setWaiver({ obligationId: obligation.id, amount: "", reason: "" })}
                style={[styles.obligationChoice, waiver.obligationId === obligation.id && styles.obligationChoiceActive]}
              >
                <View>
                  <Text style={styles.cardTitle}>{formatDonationMonth(obligation.effectiveMonth)}</Text>
                  <Text style={styles.meta}>{obligationStatusLabel(obligation.status)}</Text>
                </View>
                <Text style={styles.outstanding}>{formatPaise(obligation.outstandingAmountPaise)}</Text>
              </Pressable>
            ))}
            {waiver.obligationId ? (
              <View style={styles.inlineForm}>
                <Field label="Waiver amount in rupees" value={waiver.amount} onChangeText={(amount) => setWaiver((current) => ({ ...current, amount }))} placeholder="100.00" keyboardType="decimal-pad" />
                <Field label="Reason" value={waiver.reason} onChangeText={(reason) => setWaiver((current) => ({ ...current, reason }))} placeholder="Required reason" multiline maxLength={1000} />
                <ActionButton disabled={waive.isPending} label={waive.isPending ? "Recording..." : "Review waiver"} onPress={() => {
                  const selected = snapshot.data?.obligations.find((item) => item.id === waiver.obligationId);
                  if (selected) confirmWaiver(selected);
                }} />
              </View>
            ) : null}
          </Section>

          <Section title="Obligation rules" copy="Create a monthly amount rule using YYYY-MM.">
            {rules.isLoading ? <LoadingLine /> : null}
            {rules.isError ? <InlineError onRetry={() => void rules.refetch()} /> : null}
            {!rules.isLoading && !rules.isError && rules.data?.length === 0 ? <EmptyLine copy="No obligation rules are visible." /> : null}
            {rules.data?.map((item) => (
              <View key={item.id} style={styles.ruleRow}>
                <Text style={styles.cardTitle}>{formatDonationMonth(item.effectiveFromMonth)}</Text>
                <Text style={styles.outstanding}>{formatPaise(item.monthlyAmountPaise)}</Text>
              </View>
            ))}
            <Field label="Effective month" value={rule.month} onChangeText={(month) => setRule((current) => ({ ...current, month }))} placeholder="2026-10" />
            <Field label="Monthly amount in rupees" value={rule.amount} onChangeText={(amount) => setRule((current) => ({ ...current, amount }))} placeholder="1000.00" keyboardType="decimal-pad" />
            <ActionButton disabled={createRule.isPending} label={createRule.isPending ? "Creating..." : "Create rule"} onPress={() => Alert.alert("Create obligation rule?", "The database will enforce effective-month and uniqueness rules.", [{ text: "Cancel", style: "cancel" }, { text: "Create", onPress: () => createRule.mutate() }])} />
          </Section>

          <Section title="Generate monthly obligations" copy="The trusted database function generates all eligible obligations once.">
            <Field label="Generation month" value={generationMonth} onChangeText={setGenerationMonth} placeholder="2026-10" />
            <ActionButton disabled={generate.isPending} label={generate.isPending ? "Generating..." : "Generate obligations"} onPress={() => Alert.alert("Generate obligations?", `Generate eligible obligations for ${generationMonth || "the entered month"}?`, [{ text: "Cancel", style: "cancel" }, { text: "Generate", onPress: () => generate.mutate() }])} />
          </Section>
        </>
      ) : null}

      {resolvedCapabilities.canCreateAnonymousDonation ? (
        <Section title="Anonymous donation" copy="No donor identity is stored. Your staff action remains auditable.">
          <Field label="Amount in rupees" value={anonymousAmount} onChangeText={setAnonymousAmount} placeholder="500.00" keyboardType="decimal-pad" />
          <ActionButton disabled={anonymous.isPending} label={anonymous.isPending ? "Recording..." : "Record anonymous donation"} onPress={() => Alert.alert("Record anonymous donation?", "This records the amount without a donor or member identity.", [{ text: "Cancel", style: "cancel" }, { text: "Record", onPress: () => anonymous.mutate() }])} />
        </Section>
      ) : null}

      {resolvedCapabilities.canCreateJummahCashDonation ? (
        <Section title="Jummah cash" copy="Record the collection separately from member monthly obligations.">
          <Field label="Collection amount in rupees" value={jummahAmount} onChangeText={setJummahAmount} placeholder="2500.00" keyboardType="decimal-pad" />
          <ActionButton disabled={jummah.isPending} label={jummah.isPending ? "Recording..." : "Record Jummah cash"} onPress={() => Alert.alert("Record Jummah cash?", "This creates a distinct Jummah cash donation record.", [{ text: "Cancel", style: "cancel" }, { text: "Record", onPress: () => jummah.mutate() }])} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, copy, children }: { title: string; copy: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionCopy}>{copy}</Text>{children}</View>; }
function Field({ label, multiline = false, maxLength, ...props }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "decimal-pad"; multiline?: boolean; maxLength?: number }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} maxLength={maxLength} multiline={multiline} placeholderTextColor="#93A099" style={[styles.input, multiline && styles.multiline]} /></View>; }
function ActionButton({ label, onPress, disabled = false, secondary = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.actionButton, secondary && styles.secondaryButton, danger && styles.dangerButton, disabled && styles.disabled]}><Text style={[styles.actionText, secondary && styles.secondaryButtonText, danger && styles.dangerText]}>{label}</Text></Pressable>; }
function LoadingLine() { return <View style={styles.loadingLine}><ActivityIndicator color={colors.deepEmerald} /><Text style={styles.meta}>Loading...</Text></View>; }
function EmptyLine({ copy }: { copy: string }) { return <Text style={styles.empty}>{copy}</Text>; }
function InlineError({ onRetry }: { onRetry: () => void }) { return <View style={styles.inlineError}><Text style={styles.meta}>This section could not load.</Text><Pressable onPress={onRetry}><Text style={styles.secondaryButtonText}>Retry</Text></Pressable></View>; }
function PageState({ copy, loading = false }: { copy: string; loading?: boolean }) { return <View style={styles.pageState}>{loading ? <ActivityIndicator color={colors.deepEmerald} /> : null}<Text style={styles.pageStateCopy}>{copy}</Text></View>; }

const styles = StyleSheet.create({
  content: { backgroundColor: colors.ivory, flexGrow: 1, padding: 20, paddingBottom: 48 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
  section: { borderTopColor: colors.sand, borderTopWidth: 1, marginTop: 28, paddingTop: 22 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700" },
  sectionCopy: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginBottom: 12, marginTop: 5 },
  card: { backgroundColor: colors.surface, borderColor: colors.sand, borderRadius: 14, borderWidth: 1, marginBottom: 10, padding: 16 },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardAmount: { color: colors.text, fontSize: 20, fontWeight: "700" },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  badge: { backgroundColor: colors.sand, borderRadius: 999, color: colors.secondary, fontSize: 11, fontWeight: "700", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5 },
  meta: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  noProof: { color: colors.secondary, fontSize: 13, fontStyle: "italic", marginTop: 12 },
  proofButton: { alignSelf: "flex-start", marginTop: 10, paddingVertical: 5 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 9, marginTop: 10, minHeight: 42, paddingHorizontal: 14, paddingVertical: 11 },
  actionText: { color: colors.surface, fontSize: 13, fontWeight: "700" },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.deepEmerald, borderWidth: 1 },
  secondaryButtonText: { color: colors.deepEmerald, fontSize: 13, fontWeight: "700" },
  dangerButton: { backgroundColor: "#F7E4E2", borderColor: "#EBC6C2", borderWidth: 1 },
  dangerText: { color: colors.danger },
  disabled: { opacity: 0.55 },
  inlineForm: { borderTopColor: colors.sand, borderTopWidth: 1, marginTop: 14, paddingTop: 6 },
  field: { marginTop: 10 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7 },
  input: { backgroundColor: colors.surface, borderColor: "#D9D3C6", borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  obligationChoice: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.sand, borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: 8, padding: 14 },
  obligationChoiceActive: { borderColor: colors.gold, borderWidth: 2 },
  outstanding: { color: colors.deepEmerald, fontSize: 14, fontWeight: "700" },
  ruleRow: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", marginBottom: 7, padding: 13 },
  loadingLine: { alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 14 },
  empty: { color: colors.secondary, fontSize: 14, paddingVertical: 14 },
  inlineError: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  pageState: { alignItems: "center", backgroundColor: colors.ivory, flex: 1, justifyContent: "center", padding: 24 },
  pageStateCopy: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
});
