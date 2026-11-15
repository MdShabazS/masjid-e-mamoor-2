import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { AppText as Text } from "../../src/components/AppText";
import { AppButton, BrandedPageHeader, EmptyState, ErrorState, LoadingState } from "../../src/components/InstitutionalUI";
import { FormTextInput, Screen } from "../../src/components/Screen";
import {
  activityCustomRange, activityMonthRange, activityYearRange,
  currentIndiaMonth, listMemberActivity, type ActivityRange, type MemberActivity,
} from "../../src/modules/member-activity";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/tokens";

type Period = "month" | "year" | "custom";
const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MemberActivityScreen() {
  const { account } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [month, setMonth] = useState(currentIndiaMonth);
  const [year, setYear] = useState(() => currentIndiaMonth().slice(0, 4));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [range, setRange] = useState<ActivityRange>(() => activityMonthRange(currentIndiaMonth()));
  const activity = useQuery({
    queryKey: ["member-activity", account?.id, range.from, range.to],
    queryFn: () => listMemberActivity(range),
    enabled: Boolean(account),
  });
  function apply() {
    try {
      setRange(period === "year" ? activityYearRange(year) : period === "custom"
        ? activityCustomRange(from, to) : activityMonthRange(month));
    } catch {
      Alert.alert("Check the dates", "Enter valid dates in YYYY-MM-DD format. The start must not be after the end.");
    }
  }
  return <Screen scroll contentContainerStyle={styles.content} scrollViewProps={{
    refreshControl: <RefreshControl refreshing={activity.isRefetching} onRefresh={() => void activity.refetch()} />,
  }}>
    <BrandedPageHeader title="Member activity" description="Tasks, meetings, and verified referral contributions for Masjid E Mamoor 2." />
    <View style={styles.card}>
      <Text style={styles.label}>Period</Text>
      <View style={styles.periodRow}>{(["month", "year", "custom"] as const).map((item) =>
        <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: period === item }}
          onPress={() => setPeriod(item)} style={[styles.periodButton, period === item && styles.selected]}>
          <Text style={period === item ? styles.selectedText : styles.periodText}>{item === "custom" ? "Custom" : item === "year" ? "Year" : "Month"}</Text>
        </Pressable>)}</View>
      {period === "month" && <FormTextInput accessibilityLabel="Activity month" placeholder="YYYY-MM" value={month}
        autoCapitalize="none" onChangeText={setMonth} style={styles.input} />}
      {period === "year" && <FormTextInput accessibilityLabel="Activity year" placeholder="YYYY" keyboardType="numeric"
        value={year} onChangeText={setYear} style={styles.input} />}
      {period === "custom" && <View style={styles.customRow}>
        <FormTextInput accessibilityLabel="Activity start date" placeholder="From YYYY-MM-DD" value={from}
          onChangeText={setFrom} style={[styles.input, styles.dateInput]} />
        <FormTextInput accessibilityLabel="Activity end date" placeholder="To YYYY-MM-DD" value={to}
          onChangeText={setTo} style={[styles.input, styles.dateInput]} />
      </View>}
      <Pressable accessibilityRole="button" onPress={apply} style={styles.apply}><Text style={styles.applyText}>Apply dates</Text></Pressable>
      <Text style={styles.range}>{range.from} to {range.to}</Text>
    </View>
    <Text style={styles.note}>Completed tasks count on completion day. Meeting absence appears after the scheduled India date. Donation credit follows a verified payment from a registered member referral or a verified donation from a named referred donor.</Text>
    {activity.isLoading && <LoadingState label="Loading activity" />}
    {activity.isError && <ErrorState title="Activity unavailable" description="Check your connection and try again." action={<AppButton label="Retry" onPress={() => void activity.refetch()} variant="secondary" />} />}
    {activity.data?.length === 0 && <EmptyState title="No accounts" description="Activity will appear as accounts are created." />}
    {activity.data?.map((person) => <ActivityCard key={person.id} person={person} />)}
  </Screen>;
}

function ActivityCard({ person }: { person: MemberActivity }) {
  const rows = [
    ["Tasks assigned", person.taskAssigned], ["Tasks completed", person.taskCompleted],
    ["Meetings invited", person.meetingInvited], ["Attended", person.meetingAttended],
    ["Declined", person.meetingDeclined], ["Absent", person.meetingAbsent],
    ["Verified referred donations", person.verifiedReferredDonationCount],
    ["Verified referred amount", money(person.verifiedReferredDonationPaise)],
  ] as const;
  return <View style={styles.card}>
    <Text style={styles.name}>{person.displayName}</Text><Text style={styles.role}>{person.roleName}</Text>
    <View style={styles.metrics}>{rows.map(([label, value]) =>
      <View key={label} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>)}</View>
  </View>;
}
const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.md },
  label: { color: colors.textStrong, fontWeight: "600", marginBottom: spacing.sm },
  periodRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  periodButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selected: { backgroundColor: colors.primaryBlue, borderColor: colors.primaryBlue },
  selectedText: { color: colors.white }, periodText: { color: colors.textStrong },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, marginBottom: spacing.sm },
  customRow: { flexDirection: "row", gap: spacing.sm }, dateInput: { flex: 1 },
  apply: { backgroundColor: colors.primaryBlue, padding: spacing.md, borderRadius: 10, alignItems: "center" },
  applyText: { color: colors.white, fontWeight: "600" },
  range: { color: colors.textMuted, marginTop: spacing.sm },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  name: { color: colors.textStrong, fontSize: 18, fontWeight: "600" },
  role: { color: colors.textMuted, marginTop: 3 },
  metrics: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md },
  metric: { width: "50%", paddingVertical: spacing.sm },
  metricLabel: { color: colors.textMuted, fontSize: 12 },
  metricValue: { color: colors.textStrong, fontSize: 17, fontWeight: "600", marginTop: 2 },
});
