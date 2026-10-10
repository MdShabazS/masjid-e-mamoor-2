import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { FinancePageHeader } from "../../../../src/components/FinanceUI";
import { Screen } from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  type FinanceTransaction,
  type FinanceTransactionCategory,
  financeAccountsQueryKey,
  financeTransactionCategoryLabel,
  financeTransactionDirectionLabel,
  financeTransactionsQueryKey,
  formatFinanceMoney,
  listFinanceAccounts,
  listFinanceTransactions,
  signedFinanceTransactionAmount,
} from "../../../../src/modules/finance";
import { colors } from "../../../../src/theme/colors";

type DirectionFilter =
  | "all"
  | "inflow"
  | "outflow";

type CategoryFilter =
  | "all"
  | "donations"
  | "expenses"
  | "transfers"
  | "adjustments";

function categoryGroup(
  category: FinanceTransactionCategory,
): Exclude<CategoryFilter, "all"> {
  if (
    category === "DONATION_RECURRING" ||
    category === "DONATION_ADDITIONAL" ||
    category === "DONATION_ANONYMOUS" ||
    category === "DONATION_JUMMAH"
  ) {
    return "donations";
  }

  if (category === "EXPENSE") {
    return "expenses";
  }

  if (
    category === "TRANSFER_IN" ||
    category === "TRANSFER_OUT"
  ) {
    return "transfers";
  }

  return "adjustments";
}

function categoryFilterLabel(
  filter: CategoryFilter,
) {
  return {
    all: "All",
    donations: "Donations",
    expenses: "Expenses",
    transfers: "Transfers",
    adjustments: "Adjustments",
  }[filter];
}

function shortId(value: string) {
  if (value.length <= 12) return value;

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function transactionReferenceLabel(
  transaction: FinanceTransaction,
) {
  switch (transaction.referenceType) {
    case "donation_payment":
      return "Donation payment";

    case "additional_donation":
      return "Additional donation";

    case "anonymous_donation":
      return "Anonymous donation";

    case "jummah_cash_donation":
      return "Jummah cash donation";

    case "finance_expense":
      return "Finance expense";

    case "finance_transfer":
      return "Finance transfer";

    case "finance_adjustment":
      return "Finance adjustment";

    default:
      return transaction.referenceType;
  }
}

export default function FinanceTransactionsScreen() {
  const { account } = useAuth();

  const [directionFilter, setDirectionFilter] =
    useState<DirectionFilter>("all");

  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");

  const [
    selectedFinanceAccountId,
    setSelectedFinanceAccountId,
  ] = useState<string | null>(null);

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const access = capabilities.data;

  const transactions = useQuery({
    queryKey: financeTransactionsQueryKey(
      account?.id,
    ),
    queryFn: listFinanceTransactions,
    enabled: Boolean(
      account &&
        access?.canReadFinanceTransactions ===
          true,
    ),
  });

  const accounts = useQuery({
    queryKey: financeAccountsQueryKey(
      account?.id,
    ),
    queryFn: listFinanceAccounts,
    enabled: Boolean(
      account &&
        access?.canReadFinanceAccounts ===
          true,
    ),
  });

  const accountNames = useMemo(
    () =>
      new Map(
        (accounts.data ?? []).map(
          (financeAccount) => [
            financeAccount.id,
            financeAccount.name,
          ],
        ),
      ),
    [accounts.data],
  );

  const filteredTransactions = useMemo(
    () =>
      (transactions.data ?? []).filter(
        (transaction) => {
          if (
            directionFilter !== "all" &&
            transaction.direction !==
              directionFilter
          ) {
            return false;
          }

          if (
            categoryFilter !== "all" &&
            categoryGroup(
              transaction.transactionCategory,
            ) !== categoryFilter
          ) {
            return false;
          }

          if (
            selectedFinanceAccountId &&
            transaction.financeAccountId !==
              selectedFinanceAccountId
          ) {
            return false;
          }

          return true;
        },
      ),
    [
      categoryFilter,
      directionFilter,
      selectedFinanceAccountId,
      transactions.data,
    ],
  );

  const summary = useMemo(() => {
    let inflowPaise = 0;
    let outflowPaise = 0;
    let netPaise = 0;

    for (const transaction of
      transactions.data ?? []) {
      if (transaction.direction === "inflow") {
        inflowPaise += transaction.amountPaise;
      } else {
        outflowPaise += transaction.amountPaise;
      }

      netPaise +=
        signedFinanceTransactionAmount(
          transaction,
        );
    }

    return {
      inflowPaise,
      outflowPaise,
      netPaise,
    };
  }, [transactions.data]);

  if (!account) return null;

  if (capabilities.isLoading) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={
          styles.centerState
        }
      >
        <ActivityIndicator
          color={colors.deepEmerald}
        />

        <Text style={styles.stateCopy}>
          Loading Finance access...
        </Text>
      </Screen>
    );
  }

  if (
    capabilities.isError ||
    !access?.canReadFinanceTransactions
  ) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={
          styles.centerState
        }
      >
        <Text style={styles.eyebrow}>
          FINANCE
        </Text>

        <Text style={styles.title}>
          Transactions
        </Text>

        <Text style={styles.stateCopy}>
          Finance transaction access is not
          available for your account.
        </Text>
      </Screen>
    );
  }

  const refreshing =
    transactions.isRefetching ||
    accounts.isRefetching;

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void transactions.refetch();

              if (access.canReadFinanceAccounts) {
                void accounts.refetch();
              }
            }}
            tintColor={colors.deepEmerald}
          />
        }
      >
        <FinancePageHeader
          title="Transaction ledger"
          description="Read-only authoritative Finance ledger. Transactions are created only by validated server workflows."
        />

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Ledger entries
            </Text>

            <Text style={styles.summaryValue}>
              {transactions.data?.length ?? 0}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Inflow
            </Text>

            <Text style={styles.summaryValue}>
              {formatFinanceMoney(
                summary.inflowPaise,
              )}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Outflow
            </Text>

            <Text style={styles.summaryValue}>
              {formatFinanceMoney(
                summary.outflowPaise,
              )}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              Net ledger effect
            </Text>

            <Text style={styles.summaryValue}>
              {formatFinanceMoney(
                summary.netPaise,
              )}
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            Filters
          </Text>

          <Text style={styles.filterLabel}>
            Direction
          </Text>

          <View style={styles.filterRow}>
            {(
              [
                "all",
                "inflow",
                "outflow",
              ] as DirectionFilter[]
            ).map((filter) => {
              const selected =
                directionFilter === filter;

              return (
                <Pressable accessibilityRole="button"
                  key={filter}
                  onPress={() =>
                    setDirectionFilter(filter)
                  }
                  style={[
                    styles.filterChip,
                    selected &&
                      styles.filterChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected &&
                        styles.filterChipTextSelected,
                    ]}
                  >
                    {filter === "all"
                      ? "All"
                      : financeTransactionDirectionLabel(
                          filter,
                        )}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.filterLabel}>
            Category
          </Text>

          <View style={styles.filterRow}>
            {(
              [
                "all",
                "donations",
                "expenses",
                "transfers",
                "adjustments",
              ] as CategoryFilter[]
            ).map((filter) => {
              const selected =
                categoryFilter === filter;

              return (
                <Pressable accessibilityRole="button"
                  key={filter}
                  onPress={() =>
                    setCategoryFilter(filter)
                  }
                  style={[
                    styles.filterChip,
                    selected &&
                      styles.filterChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected &&
                        styles.filterChipTextSelected,
                    ]}
                  >
                    {categoryFilterLabel(filter)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {access.canReadFinanceAccounts &&
          (accounts.data?.length ?? 0) > 0 ? (
            <>
              <Text style={styles.filterLabel}>
                Finance account
              </Text>

              <View style={styles.accountFilters}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected:
                      selectedFinanceAccountId === null,
                  }}
                  onPress={() =>
                    setSelectedFinanceAccountId(
                      null,
                    )
                  }
                  style={[
                    styles.accountFilter,
                    selectedFinanceAccountId ===
                      null &&
                      styles.accountFilterSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.accountFilterText,
                      selectedFinanceAccountId ===
                        null &&
                        styles.accountFilterTextSelected,
                    ]}
                  >
                    All accounts
                  </Text>
                </Pressable>

                {(accounts.data ?? []).map(
                  (financeAccount) => {
                    const selected =
                      selectedFinanceAccountId ===
                      financeAccount.id;

                    return (
                      <Pressable
                        key={financeAccount.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() =>
                          setSelectedFinanceAccountId(
                            financeAccount.id,
                          )
                        }
                        style={[
                          styles.accountFilter,
                          selected &&
                            styles.accountFilterSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.accountFilterText,
                            selected &&
                              styles.accountFilterTextSelected,
                          ]}
                        >
                          {financeAccount.name}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </>
          ) : null}

          <Text style={styles.filterResult}>
            Showing{" "}
            {filteredTransactions.length} of{" "}
            {transactions.data?.length ?? 0}{" "}
            transactions.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Ledger history
            </Text>

            <Text style={styles.help}>
              Ordered by business date, then
              creation time.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              transactions.refetch()
            }
          >
            <Text style={styles.refreshAction}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {transactions.isLoading ? (
          <View
            accessible
            accessibilityLabel="Loading Finance transactions..."
            accessibilityRole="progressbar"
            style={styles.statePanel}
          >
            <ActivityIndicator
              color={colors.deepEmerald}
            />

            <Text style={styles.stateCopy}>
              Loading Finance transactions...
            </Text>
          </View>
        ) : null}

        {transactions.isError ? (
          <View
            accessible
            accessibilityRole="alert"
            style={styles.statePanel}
          >
            <Text style={styles.errorCopy}>
              Finance transactions could not be
              loaded.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                transactions.refetch()
              }
              style={styles.secondaryButton}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!transactions.isLoading &&
        !transactions.isError &&
        (transactions.data?.length ?? 0) ===
          0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateCopy}>
              No authoritative Finance ledger
              transactions have been posted yet.
            </Text>
          </View>
        ) : null}

        {!transactions.isLoading &&
        !transactions.isError &&
        (transactions.data?.length ?? 0) > 0 &&
        filteredTransactions.length === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateCopy}>
              No transactions match the selected
              filters.
            </Text>
          </View>
        ) : null}

        {filteredTransactions.map(
          (transaction) => {
            const signedAmount =
              signedFinanceTransactionAmount(
                transaction,
              );

            return (
              <View
                key={transaction.id}
                style={styles.transactionCard}
              >
                <View
                  style={styles.cardTopRow}
                >
                  <View style={styles.cardTopCopy}>
                    <Text
                      style={
                        styles.transactionTitle
                      }
                    >
                      {financeTransactionCategoryLabel(
                        transaction.transactionCategory,
                      )}
                    </Text>

                    <Text style={styles.meta}>
                      {transaction.businessDate}
                      {" · "}
                      {accountNames.get(
                        transaction.financeAccountId,
                      ) ?? "Finance account"}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.amount,
                      transaction.direction ===
                        "inflow"
                        ? styles.inflowAmount
                        : styles.outflowAmount,
                    ]}
                  >
                    {signedAmount >= 0 ? "+" : ""}
                    {formatFinanceMoney(
                      signedAmount,
                    )}
                  </Text>
                </View>

                <View style={styles.badgeRow}>
                  <Text
                    style={[
                      styles.directionBadge,
                      transaction.direction ===
                        "inflow"
                        ? styles.inflowBadge
                        : styles.outflowBadge,
                    ]}
                  >
                    {financeTransactionDirectionLabel(
                      transaction.direction,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.categoryBadge
                    }
                  >
                    {
                      transaction.transactionCategory
                    }
                  </Text>
                </View>

                <View style={styles.details}>
                  <View style={styles.detailRow}>
                    <Text
                      style={styles.detailLabel}
                    >
                      Transaction ID
                    </Text>

                    <Text
                      selectable
                      style={styles.detailValue}
                    >
                      {shortId(transaction.id)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text
                      style={styles.detailLabel}
                    >
                      Source
                    </Text>

                    <Text
                      style={styles.detailValue}
                    >
                      {transactionReferenceLabel(
                        transaction,
                      )}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text
                      style={styles.detailLabel}
                    >
                      Reference
                    </Text>

                    <Text
                      selectable
                      style={styles.detailValue}
                    >
                      {shortId(
                        transaction.referenceId,
                      )}
                    </Text>
                  </View>

                  {transaction.relatedTransactionId ? (
                    <View style={styles.detailRow}>
                      <Text
                        style={styles.detailLabel}
                      >
                        Related transaction
                      </Text>

                      <Text
                        selectable
                        style={
                          styles.detailValue
                        }
                      >
                        {shortId(
                          transaction
                            .relatedTransactionId,
                        )}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {transaction.transactionCategory ===
                  "TRANSFER_IN" ||
                transaction.transactionCategory ===
                  "TRANSFER_OUT" ? (
                  <Text style={styles.notice}>
                    This is one side of an internal
                    transfer. It must not be counted
                    as new Masjid income or expense.
                  </Text>
                ) : null}

                {transaction.transactionCategory ===
                  "CORRECTION" ||
                transaction.transactionCategory ===
                  "REVERSAL" ? (
                  <Text style={styles.notice}>
                    This ledger entry is append-only
                    financial adjustment history
                    linked to the original
                    transaction.
                  </Text>
                ) : null}
              </View>
            );
          },
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 60,
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
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: "47%",
    padding: 14,
  },
  summaryLabel: {
    color: colors.secondary,
    fontSize: 12,
  },
  summaryValue: {
    color: colors.deepEmerald,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 5,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 22,
    padding: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  filterLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    borderColor: colors.sand,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  filterChipText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextSelected: {
    color: "#FFFFFF",
  },
  accountFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  accountFilter: {
    backgroundColor: "#F8F6F0",
    borderColor: colors.sand,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  accountFilterSelected: {
    backgroundColor: "#DDEDE5",
    borderColor: colors.deepEmerald,
  },
  accountFilterText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  accountFilterTextSelected: {
    color: colors.deepEmerald,
    fontWeight: "800",
  },
  filterResult: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 16,
  },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  help: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  refreshAction: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    padding: 20,
  },
  stateCopy: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  errorCopy: {
    color: "#9B2C2C",
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryButton: {
    borderColor: colors.deepEmerald,
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  transactionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  cardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  cardTopCopy: {
    flex: 1,
    minWidth: "60%",
  },
  transactionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  amount: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  inflowAmount: {
    color: colors.deepEmerald,
  },
  outflowAmount: {
    color: "#9B2C2C",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  directionBadge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inflowBadge: {
    backgroundColor: "#DDEDE5",
    color: colors.deepEmerald,
  },
  outflowBadge: {
    backgroundColor: "#F4DDDD",
    color: "#8F2F2F",
  },
  categoryBadge: {
    backgroundColor: "#F5E7B8",
    borderRadius: 999,
    color: "#6E5714",
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  details: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  detailLabel: {
    color: colors.secondary,
    fontSize: 12,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  notice: {
    color: colors.secondary,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 12,
  },
});
