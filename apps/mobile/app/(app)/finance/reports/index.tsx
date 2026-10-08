import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useMutation,
  useQuery,
} from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import {
  FormTextInput,
  Screen,
} from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  type FinanceMonthlyReport,
  financeMonthlyReportsQueryKey,
  financeMonthlyReportStatusLabel,
  formatFinanceMoney,
  formatFinanceReportMonth,
  generateFinanceMonthlyReport,
  getFinanceMonthlyReportPdfUrl,
  listFinanceMonthlyReports,
} from "../../../../src/modules/finance";
import { colors } from "../../../../src/theme/colors";

export default function FinanceMonthlyReportsScreen() {
  const { account } = useAuth();

  const [reportMonth, setReportMonth] = useState(
    defaultReportMonth,
  );

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const authorized =
    capabilities.data?.canReadFinanceMonthlyReports === true;

  const reports = useQuery({
    queryKey: financeMonthlyReportsQueryKey(account?.id),
    queryFn: listFinanceMonthlyReports,
    enabled: Boolean(account) && authorized,
  });

  const generate = useMutation({
    mutationFn: () =>
      generateFinanceMonthlyReport(reportMonth),

    onSuccess: async () => {
      await reports.refetch();

      Alert.alert(
        "Monthly report requested",
        "The Finance report was generated or is already being rendered. The report history has been refreshed.",
      );
    },

    onError: (error) => {
      Alert.alert(
        "Monthly report could not be generated",
        error.message ===
          "finance_monthly_report_month_invalid"
          ? "Enter the reporting month as YYYY-MM."
          : "Check your Finance report management permission and try again.",
      );
    },
  });

  const openPdf = useMutation({
    mutationFn: async (report: FinanceMonthlyReport) => {
      const url =
        await getFinanceMonthlyReportPdfUrl(report);

      await Linking.openURL(url);
    },
    onError: () => {
      Alert.alert(
        "Report could not be opened",
        "The PDF is not currently available. Refresh the report list and try again.",
      );
    },
  });

  if (!account) return null;

  if (capabilities.isLoading) {
    return (
      <LoadingState copy="Loading Monthly Reports access..." />
    );
  }

  if (
    capabilities.isError ||
    !capabilities.data?.canReadFinanceMonthlyReports
  ) {
    return <AccessState />;
  }

  const items = reports.data ?? [];
  const readyCount = items.filter(
    (report) => report.status === "ready",
  ).length;

  return (
    <Screen
      edges={["left", "right", "bottom"]}
      scroll
      contentContainerStyle={styles.content}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={reports.isRefetching}
            onRefresh={() => void reports.refetch()}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <Text style={styles.eyebrow}>FINANCE</Text>

      <Text style={styles.title}>
        Monthly reports
      </Text>

      <Text style={styles.intro}>
        Immutable monthly Finance summaries and generated
        PDF report packs.
      </Text>

      {reports.isLoading ? <LoadingPanel /> : null}

      {reports.isError ? (
        <ErrorPanel
          onRetry={() => void reports.refetch()}
        />
      ) : null}

      {!reports.isLoading && !reports.isError ? (
        <>
          <View style={styles.summaryGrid}>
            <Summary
              label="Reports"
              value={String(items.length)}
            />
            <Summary
              label="PDF ready"
              value={String(readyCount)}
            />
          </View>

          {capabilities.data
            .canManageFinanceMonthlyReports ? (
            <View style={styles.adminPanel}>
              <Text style={styles.adminTitle}>
                Generate monthly report
              </Text>

              <Text style={styles.help}>
                Create or regenerate an authoritative
                monthly Finance snapshot and PDF. Existing
                report history remains revisioned.
              </Text>

              <Text style={styles.fieldLabel}>
                Reporting month
              </Text>

              <FormTextInput
                value={reportMonth}
                onChangeText={setReportMonth}
                placeholder="YYYY-MM"
                placeholderTextColor="#93A099"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
                style={styles.input}
              />

              <Pressable
                disabled={
                  generate.isPending ||
                  reportMonth.trim().length === 0
                }
                onPress={() => generate.mutate()}
                style={[
                  styles.primaryButton,
                  (generate.isPending ||
                    reportMonth.trim().length === 0) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {generate.isPending
                    ? "Generating report..."
                    : "Generate monthly report"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!capabilities.data
            .canManageFinanceMonthlyReports ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>
                Read-only Monthly Reports access
              </Text>
              <Text style={styles.help}>
                You can review monthly summaries and
                available PDF packs. Report generation is
                restricted to authorized Finance managers.
              </Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>
            Report history
          </Text>

          {items.length === 0 ? (
            <View style={styles.statePanel}>
              <Text style={styles.stateTitle}>
                No monthly reports yet
              </Text>
              <Text style={styles.stateCopy}>
                Monthly Finance reports will appear here
                after the reporting pipeline creates the
                first report snapshot.
              </Text>
            </View>
          ) : (
            items.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                openingPdf={
                  openPdf.isPending &&
                  openPdf.variables?.id === report.id
                }
                onOpen={() =>
                  openPdf.mutate(report)
                }
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

function ReportCard({
  report,
  openingPdf,
  onOpen,
}: {
  report: FinanceMonthlyReport;
  openingPdf: boolean;
  onOpen: () => void;
}) {
  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportHeaderCopy}>
          <Text style={styles.reportMonth}>
            {formatFinanceReportMonth(
              report.reportMonth,
            )}
          </Text>

          <Text style={styles.reportMeta}>
            Revision {report.revision} ·{" "}
            {report.generationSource === "scheduled"
              ? "Scheduled"
              : "Manual"}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {financeMonthlyReportStatusLabel(
              report.status,
            )}
          </Text>
        </View>
      </View>

      <View style={styles.moneyGrid}>
        <Money
          label="Opening balance"
          value={report.openingBalancePaise}
        />
        <Money
          label="Donation inflow"
          value={report.donationInflowPaise}
        />
        <Money
          label="Expense outflow"
          value={report.expenseOutflowPaise}
        />
        <Money
          label="Closing balance"
          value={report.closingBalancePaise}
          emphasized
        />
      </View>

      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>
          Closing balance by account type
        </Text>

        <Text style={styles.breakdownCopy}>
          Cash {formatFinanceMoney(report.cashClosingPaise)}
          {"  ·  "}
          Bank {formatFinanceMoney(report.bankClosingPaise)}
        </Text>

        <Text style={styles.breakdownCopy}>
          UPI {formatFinanceMoney(report.upiClosingPaise)}
          {"  ·  "}
          Other {formatFinanceMoney(report.otherClosingPaise)}
        </Text>

        <Text style={styles.transactionCopy}>
          {report.transactionCount.toLocaleString("en-IN")}{" "}
          ledger transaction
          {report.transactionCount === 1 ? "" : "s"}
        </Text>
      </View>

      {report.status === "ready" ? (
        <Pressable
          disabled={openingPdf}
          onPress={onOpen}
          style={[
            styles.primaryButton,
            openingPdf && styles.disabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {openingPdf
              ? "Opening PDF..."
              : "Open monthly report PDF"}
          </Text>
        </Pressable>
      ) : null}

      {report.status === "generating" ? (
        <Text style={styles.lifecycleCopy}>
          PDF generation is in progress. Pull to refresh
          for the latest status.
        </Text>
      ) : null}

      {report.status === "failed" ? (
        <Text style={styles.failureCopy}>
          The last PDF generation attempt failed. The
          financial snapshot remains recorded.
        </Text>
      ) : null}
    </View>
  );
}

function Money({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.moneyItem}>
      <Text style={styles.moneyLabel}>
        {label}
      </Text>
      <Text
        style={[
          styles.moneyValue,
          emphasized && styles.moneyEmphasized,
        ]}
      >
        {formatFinanceMoney(value)}
      </Text>
    </View>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>
        {label}
      </Text>
    </View>
  );
}

function LoadingPanel() {
  return (
    <View style={styles.statePanel}>
      <ActivityIndicator color={colors.deepEmerald} />
      <Text style={styles.stateCopy}>
        Loading monthly reports...
      </Text>
    </View>
  );
}

function LoadingState({
  copy,
}: {
  copy: string;
}) {
  return (
    <Screen
      edges={["left", "right", "bottom"]}
      contentContainerStyle={styles.centerState}
    >
      <ActivityIndicator color={colors.deepEmerald} />
      <Text style={styles.stateCopy}>
        {copy}
      </Text>
    </Screen>
  );
}

function ErrorPanel({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <View style={styles.statePanel}>
      <Text style={styles.stateTitle}>
        Monthly reports could not load
      </Text>
      <Text style={styles.stateCopy}>
        Check your connection and try again.
      </Text>
      <Pressable
        onPress={onRetry}
        style={styles.retryButton}
      >
        <Text style={styles.retryText}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

function AccessState() {
  return (
    <Screen
      edges={["left", "right", "bottom"]}
      contentContainerStyle={styles.centerState}
    >
      <Text style={styles.eyebrow}>
        FINANCE
      </Text>
      <Text style={styles.title}>
        Monthly reports
      </Text>
      <Text style={styles.stateCopy}>
        Monthly Finance Reports access is not available
        for your account.
      </Text>
    </Screen>
  );
}

function defaultReportMonth() {
  const date = new Date();

  date.setMonth(date.getMonth() - 1);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  intro: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: "47%",
    padding: 14,
  },
  summaryValue: {
    color: colors.deepEmerald,
    fontSize: 20,
    fontWeight: "700",
  },
  summaryLabel: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  adminPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 24,
    padding: 18,
  },
  adminTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: "#D9D3C6",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },

  notice: {
    backgroundColor: colors.sand,
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  help: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 26,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  reportHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reportHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  reportMonth: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  reportMeta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 5,
  },
  statusBadge: {
    backgroundColor: colors.sand,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: colors.deepEmerald,
    fontSize: 11,
    fontWeight: "700",
  },
  moneyGrid: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 16,
    paddingTop: 14,
  },
  moneyItem: {
    minWidth: "45%",
  },
  moneyLabel: {
    color: colors.secondary,
    fontSize: 11,
  },
  moneyValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  moneyEmphasized: {
    color: colors.deepEmerald,
    fontSize: 18,
    fontWeight: "700",
  },
  breakdown: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
  },
  breakdownTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  breakdownCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  transactionCopy: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
  lifecycleCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  failureCopy: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginTop: 22,
    padding: 24,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  stateCopy: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    padding: 8,
  },
  retryText: {
    color: colors.deepEmerald,
    fontWeight: "700",
  },
});
