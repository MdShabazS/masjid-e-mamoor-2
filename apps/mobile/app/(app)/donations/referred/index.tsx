import { useState } from "react";
import { Alert, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../../src/auth/AuthProvider";
import { AppText as Text } from "../../../../src/components/AppText";
import { AppButton, BrandedPageHeader, ErrorState, LoadingState } from "../../../../src/components/InstitutionalUI";
import { FormTextInput, Screen } from "../../../../src/components/Screen";
import { listActiveFinanceAccounts } from "../../../../src/modules/finance";
import { canReviewReferredDonations, decideReferredDonation, listDonationReferrers, listReferredDonations,
  saveReferredDonationReceipt, submitReferredDonation, voidVerifiedReferredDonation } from "../../../../src/modules/referred-donations";
import { colors } from "../../../../src/theme/colors";

const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function ReferredDonationsScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [referrerId, setReferrerId] = useState("");
  const [purpose, setPurpose] = useState("General donation");
  const [donationDate, setDonationDate] = useState(dateToday);
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [replacesId, setReplacesId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [businessDate, setBusinessDate] = useState(dateToday);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [voidReasons, setVoidReasons] = useState<Record<string, string>>({});
  const records = useQuery({ queryKey: ["referred-donations", account?.id], queryFn: listReferredDonations, enabled: Boolean(account) });
  const referrers = useQuery({ queryKey: ["donation-referrers", account?.id], queryFn: listDonationReferrers, enabled: Boolean(account) });
  const reviewer = useQuery({ queryKey: ["referred-donations-reviewer", account?.id], queryFn: () => canReviewReferredDonations(account!), enabled: Boolean(account) });
  const accounts = useQuery({ queryKey: ["referred-donations-accounts", account?.id], queryFn: listActiveFinanceAccounts,
    enabled: reviewer.data === true });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["referred-donations"] });
    void queryClient.invalidateQueries({ queryKey: ["member-activity"] });
    void queryClient.invalidateQueries({ queryKey: ["finance"] }); };
  const submit = useMutation({ mutationFn: () => submitReferredDonation(name, amount, method,
    referrerId, purpose, donationDate, phone, reference, replacesId), onSuccess: () => {
    setName(""); setAmount(""); setPhone(""); setReference(""); setReplacesId(null); refresh(); Alert.alert("Submitted", "The Treasurer can now verify the donation. No amount is posted until verification.");
  }, onError: () => Alert.alert("Could not submit", "Check the donor name and amount, then try again.") });
  const decide = useMutation({ mutationFn: (input: { id: string; approve: boolean }) =>
    decideReferredDonation(input.id, input.approve, input.approve ? accountId : null,
      input.approve ? businessDate : null, input.approve ? null : reasons[input.id] ?? ""),
    onSuccess: () => { refresh(); Alert.alert("Decision saved", "The donation record has been updated."); },
    onError: () => Alert.alert("Decision failed", "Check the account, date, and reviewer permissions.") });
  const voidReceipt = useMutation({ mutationFn: (input: { id: string; reason: string }) =>
    voidVerifiedReferredDonation(input.id, input.reason),
    onSuccess: () => { refresh(); Alert.alert("Receipt voided", "A dated reversal was posted. Submit a corrected donation for a new receipt."); },
    onError: () => Alert.alert("Could not void receipt", "Check the reason and Treasurer access, then try again.") });
  return <Screen scroll keyboardAware contentContainerStyle={styles.content} scrollViewProps={{
    refreshControl: <RefreshControl refreshing={records.isRefetching} onRefresh={() => void records.refetch()} />,
  }}>
    <BrandedPageHeader title="Referred donors" description="Record named donor contributions. Only verified amounts enter Finance and member activity." />
    <View style={styles.card}><Text style={styles.title}>{replacesId ? "Correct rejected or voided donation" : "Submit a donation"}</Text>
      {replacesId && <AppButton label="Cancel correction" variant="secondary" onPress={() => setReplacesId(null)} />}
      <Text style={styles.label}>Donor name</Text><FormTextInput accessibilityLabel="Donor name" value={name} onChangeText={setName} maxLength={160} style={styles.input} />
      <Text style={styles.label}>Amount (₹)</Text><FormTextInput accessibilityLabel="Donation amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.input} />
      <Text style={styles.label}>Payment method</Text><View style={styles.row}>{(["cash", "upi", "bank_transfer"] as const).map(value =>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: method === value }} key={value} onPress={() => setMethod(value)}
          style={[styles.choice, method === value && styles.selected]}><Text style={method === value ? styles.selectedText : styles.choiceText}>{value.replaceAll("_", " ").toUpperCase()}</Text></Pressable>)}</View>
      <Text style={styles.label}>Member who brought the donor</Text><View style={styles.row}>{referrers.data?.map(person =>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: referrerId === person.id }}
          key={person.id} onPress={() => setReferrerId(person.id)} style={[styles.choice, referrerId === person.id && styles.selected]}>
          <Text style={referrerId === person.id ? styles.selectedText : styles.choiceText}>{person.displayName}</Text>
        </Pressable>)}</View>
      {referrers.isError && <Text>Member list unavailable. Refresh to retry.</Text>}
      <Text style={styles.label}>Donation date (YYYY-MM-DD)</Text><FormTextInput accessibilityLabel="Donation date"
        value={donationDate} onChangeText={setDonationDate} style={styles.input} />
      <Text style={styles.label}>Purpose</Text><FormTextInput accessibilityLabel="Donation purpose" value={purpose}
        onChangeText={setPurpose} maxLength={200} style={styles.input} />
      <Text style={styles.label}>Donor phone (optional)</Text><FormTextInput accessibilityLabel="Donor phone" value={phone}
        onChangeText={setPhone} keyboardType="phone-pad" maxLength={25} style={styles.input} />
      {method !== "cash" && <><Text style={styles.label}>UPI or bank reference</Text>
        <FormTextInput accessibilityLabel="Payment reference" value={reference} onChangeText={setReference}
          maxLength={120} style={styles.input} /></>}
      <AppButton label={submit.isPending ? "Submitting…" : "Submit for verification"} disabled={submit.isPending} onPress={() => submit.mutate()} />
    </View>
    {reviewer.data === true && <View style={styles.card}><Text style={styles.title}>Review settings</Text>
      <Text style={styles.label}>Finance account</Text><View style={styles.row}>{accounts.data?.map(item =>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: accountId === item.id }} key={item.id}
          onPress={() => setAccountId(item.id)} style={[styles.choice, accountId === item.id && styles.selected]}>
          <Text style={accountId === item.id ? styles.selectedText : styles.choiceText}>{item.name}</Text>
        </Pressable>)}</View>
      {accounts.data?.length === 0 && <Text>No active Finance account is available.</Text>}
      <Text style={styles.label}>Business date (YYYY-MM-DD)</Text><FormTextInput accessibilityLabel="Donation business date" value={businessDate}
        onChangeText={setBusinessDate} keyboardType="numbers-and-punctuation" style={styles.input} />
    </View>}
    {records.isLoading && <LoadingState label="Loading donations" />}
    {records.isError && <ErrorState title="Donations unavailable" description="Check your connection and try again."
      action={<AppButton label="Retry" onPress={() => void records.refetch()} variant="secondary" />} />}
    <Text style={styles.title}>Recent submissions</Text>
    {records.data?.length === 0 && <Text>No referred donor contributions yet.</Text>}
    {records.data?.map(item => <View key={item.id} style={styles.card}>
      <Text style={styles.title}>{item.donorName} · {money(item.amountPaise)}</Text>
      <Text style={styles.detail}>{item.paymentMethod.replaceAll("_", " ")} · {item.status} · {item.donationDate} · {item.purpose}</Text>
      <Text style={styles.detail}>Referred by {referrers.data?.find(person => person.id === item.referrerId)?.displayName ?? "Member"}</Text>
      {item.rejectionReason && <Text style={styles.detail}>Reason: {item.rejectionReason}</Text>}
      {item.voidReason && <Text style={styles.detail}>Voided receipt {item.receiptNumber}: {item.voidReason}</Text>}
      {item.replacesId && <Text style={styles.detail}>Correction of an earlier rejected or voided submission</Text>}
      {(item.status === "rejected" || item.status === "voided") && item.submitterId === account?.id &&
        !records.data?.some(revision => revision.replacesId === item.id) &&
        <AppButton label="Correct and resubmit" variant="secondary" onPress={() => {
          setName(item.donorName); setAmount((item.amountPaise / 100).toFixed(2)); setMethod(item.paymentMethod);
          setReferrerId(item.referrerId); setPurpose(item.purpose); setDonationDate(item.donationDate);
          setPhone(item.donorPhone ?? ""); setReference(item.paymentReference ?? ""); setReplacesId(item.id);
          Alert.alert("Edit the form above", "Correct the details and submit again. The original stays in the history.");
        }} />}
      {item.status === "verified" && item.receiptNumber && <AppButton label={`Save receipt ${item.receiptNumber}`} variant="secondary" onPress={() => {
        void saveReferredDonationReceipt(item.id, item.receiptNumber!).then(saved => {
          if (saved) Alert.alert("Receipt saved", "The PDF was saved in your selected folder.");
        }).catch(() => Alert.alert("Receipt unavailable", "Please try again later."));
      }} />}
      {reviewer.data === true && item.status === "verified" && <View style={styles.review}>
        <Text style={styles.label}>Reason to void this receipt (at least 10 characters)</Text>
        <FormTextInput accessibilityLabel={`Void reason for ${item.donorName}`} value={voidReasons[item.id] ?? ""}
          onChangeText={value => setVoidReasons(current => ({ ...current, [item.id]: value }))}
          maxLength={1000} multiline style={styles.input} />
        <AppButton label="Void receipt and reverse posting" variant="secondary"
          disabled={voidReceipt.isPending || (voidReasons[item.id]?.trim().length ?? 0) < 10}
          onPress={() => Alert.alert("Void verified receipt?", "This posts a dated reversal and invalidates the public receipt. The original stays in the audit history.", [
            { text: "Cancel", style: "cancel" },
            { text: "Void and reverse", style: "destructive", onPress: () => voidReceipt.mutate({ id: item.id, reason: voidReasons[item.id] ?? "" }) },
          ])} />
      </View>}
      {reviewer.data === true && item.status === "submitted" && <View style={styles.review}>
        <AppButton label="Verify and post" disabled={decide.isPending || !accountId} onPress={() =>
          Alert.alert("Verify donation?", "This posts the amount to Finance and issues a receipt.", [
            { text: "Cancel", style: "cancel" }, { text: "Verify", onPress: () => decide.mutate({ id: item.id, approve: true }) },
          ])} />
        <Text style={styles.label}>Rejection reason</Text><FormTextInput accessibilityLabel={`Rejection reason for ${item.donorName}`}
          value={reasons[item.id] ?? ""} onChangeText={value => setReasons(current => ({ ...current, [item.id]: value }))}
          maxLength={1000} multiline style={styles.input} />
        <AppButton label="Reject" variant="secondary" disabled={decide.isPending || !reasons[item.id]?.trim()}
          onPress={() => decide.mutate({ id: item.id, approve: false })} />
      </View>}
    </View>)}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 48 },
  card: { padding: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9e3df", borderRadius: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.deepEmerald },
  label: { fontSize: 13, fontWeight: "600", color: colors.deepEmerald },
  input: { borderWidth: 1, borderColor: "#d9e3df", borderRadius: 9, padding: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { borderWidth: 1, borderColor: "#a9bcb4", borderRadius: 10, padding: 10 },
  selected: { backgroundColor: colors.deepEmerald },
  selectedText: { color: "#fff" }, choiceText: { color: colors.deepEmerald },
  detail: { color: "#55645f", fontSize: 13 }, review: { borderTopWidth: 1, borderColor: "#d9e3df", paddingTop: 12, gap: 10 },
});
