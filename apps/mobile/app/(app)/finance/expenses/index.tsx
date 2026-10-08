import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import { Screen } from "../../../../src/components/Screen";
import {
  formatIsoDateInput,
  isValidIsoDate,
} from "../../../../src/lib/date-input";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import { parseRupeesToPaise } from "../../../../src/modules/donation-presentation";
import {
  type FinanceExpense,
  decideFinanceExpense,
  financeAccountsQueryKey,
  financeExpensesQueryKey,
  financeExpenseStatusLabel,
  formatFinanceMoney,
  listFinanceAccounts,
  listFinanceExpenses,
  submitFinanceExpense,
} from "../../../../src/modules/finance";
import { colors } from "../../../../src/theme/colors";

function localIsoDate() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function expenseErrorMessage(error: Error) {
  switch (error.message) {
    case "finance_expense_account_required":
      return "Select the Finance account that will pay this expense.";

    case "finance_expense_amount_invalid":
      return "Enter a valid expense amount greater than ₹0.";

    case "finance_expense_description_invalid":
      return "Enter an expense description.";

    case "finance_expense_payee_invalid":
      return "Payee must be 200 characters or fewer.";

    case "finance_expense_business_date_invalid":
      return "Enter a valid business date as YYYY-MM-DD.";

    case "finance_expense_reason_required":
      return "A rejection reason is required.";

    case "finance_expense_reason_invalid":
      return "Rejection reason must be 2000 characters or fewer.";

    case "finance_expense_decide_failed":
      return "The expense could not be approved or rejected. Check its current state, maker/checker rule, and your permission.";

    default:
      return "The Finance expense operation could not be completed.";
  }
}

export default function FinanceExpensesScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState({
    financeAccountId: "",
    amount: "",
    description: "",
    payee: "",
    businessDate: localIsoDate(),
  });

  const [rejectingExpenseId, setRejectingExpenseId] =
    useState<string | null>(null);

  const [rejectionReason, setRejectionReason] =
    useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const access = capabilities.data;

  const canAccessExpenses =
    access?.canReadFinanceTransactions === true ||
    access?.canCreateFinanceExpenses === true ||
    access?.canApproveFinanceExpenses === true;

  const expenseKey = financeExpensesQueryKey(
    account?.id,
  );

  const expenses = useQuery({
    queryKey: expenseKey,
    queryFn: listFinanceExpenses,
    enabled: Boolean(account && canAccessExpenses),
  });

  const accounts = useQuery({
    queryKey: financeAccountsQueryKey(account?.id),
    queryFn: listFinanceAccounts,
    enabled: Boolean(
      account &&
        access?.canReadFinanceAccounts === true,
    ),
  });

  const activeAccounts = useMemo(
    () =>
      (accounts.data ?? []).filter(
        (item) => item.status === "active",
      ),
    [accounts.data],
  );

  const accountNames = useMemo(
    () =>
      new Map(
        (accounts.data ?? []).map((item) => [
          item.id,
          item.name,
        ]),
      ),
    [accounts.data],
  );

  const parsedAmount =
    parseRupeesToPaise(draft.amount);

  const draftIsValid =
    Boolean(draft.financeAccountId) &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    draft.description.trim().length > 0 &&
    draft.description.trim().length <= 2000 &&
    draft.payee.trim().length <= 200 &&
    isValidIsoDate(draft.businessDate);

  const submitExpense = useMutation({
    mutationFn: () =>
      submitFinanceExpense({
        financeAccountId:
          draft.financeAccountId,
        amount: draft.amount,
        description: draft.description,
        payee: draft.payee,
        businessDate: draft.businessDate,
      }),

    onSuccess: async () => {
      setDraft({
        financeAccountId: "",
        amount: "",
        description: "",
        payee: "",
        businessDate: localIsoDate(),
      });

      await expenses.refetch();

      Alert.alert(
        "Expense submitted",
        "The expense is awaiting approval by another authorized Finance user.",
      );
    },

    onError: (error) => {
      Alert.alert(
        "Expense could not be submitted",
        expenseErrorMessage(error),
      );
    },
  });

  const decideExpense = useMutation({
    mutationFn: decideFinanceExpense,

    onSuccess: async () => {
      setRejectingExpenseId(null);
      setRejectionReason("");

      await expenses.refetch();

      await queryClient.invalidateQueries({
        queryKey: ["finance", "accounts"],
      });
    },

    onError: (error) => {
      Alert.alert(
        "Expense decision failed",
        expenseErrorMessage(error),
      );
    },
  });

  function confirmApprove(
    expense: FinanceExpense,
  ) {
    Alert.alert(
      "Approve expense?",
      `Approve ${formatFinanceMoney(
        expense.amountPaise,
      )} for ${expense.description}? This will post an outflow to the selected Finance account.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Approve",
          onPress: () =>
            decideExpense.mutate({
              financeExpenseId: expense.id,
              decision: "approve",
            }),
        },
      ],
    );
  }

  function confirmReject(
    expense: FinanceExpense,
  ) {
    const reason = rejectionReason.trim();

    if (!reason) {
      Alert.alert(
        "Rejection reason required",
        "Enter why this expense is being rejected.",
      );
      return;
    }

    Alert.alert(
      "Reject expense?",
      "This expense will be rejected and no Finance transaction will be posted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reject",
          style: "destructive",
          onPress: () =>
            decideExpense.mutate({
              financeExpenseId: expense.id,
              decision: "reject",
              reason,
            }),
        },
      ],
    );
  }

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
    !access ||
    !canAccessExpenses
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
          Expenses
        </Text>

        <Text style={styles.stateCopy}>
          Expense access is not available for
          your account.
        </Text>
      </Screen>
    );
  }

  const refreshing =
    expenses.isRefetching ||
    accounts.isRefetching;

  const pendingCount =
    expenses.data?.filter(
      (item) => item.status === "submitted",
    ).length ?? 0;

  const postedCount =
    expenses.data?.filter(
      (item) => item.status === "posted",
    ).length ?? 0;

  return (
    <Screen edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void expenses.refetch();

              if (
                access.canReadFinanceAccounts
              ) {
                void accounts.refetch();
              }
            }}
            tintColor={colors.deepEmerald}
          />
        }
      >
        <Text style={styles.eyebrow}>
          FINANCE
        </Text>

        <Text style={styles.title}>
          Expenses
        </Text>

        <Text style={styles.intro}>
          Submit operational expenses and review
          their approval and posting lifecycle.
        </Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {pendingCount}
            </Text>
            <Text style={styles.summaryLabel}>
              Pending
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {postedCount}
            </Text>
            <Text style={styles.summaryLabel}>
              Posted
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {expenses.data?.length ?? 0}
            </Text>
            <Text style={styles.summaryLabel}>
              Total
            </Text>
          </View>
        </View>

        {access.canCreateFinanceExpenses ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              Submit expense
            </Text>

            <Text style={styles.help}>
              Submission does not immediately
              reduce the account balance. Another
              authorized Finance user must approve
              it.
            </Text>

            <Text style={styles.fieldLabel}>
              Paying Finance account
            </Text>

            {accounts.isLoading ? (
              <Text style={styles.help}>
                Loading active accounts...
              </Text>
            ) : null}

            {accounts.isError ? (
              <Text style={styles.errorCopy}>
                Finance accounts could not be
                loaded.
              </Text>
            ) : null}

            {!accounts.isLoading &&
            !accounts.isError &&
            activeAccounts.length === 0 ? (
              <Text style={styles.errorCopy}>
                No active Finance account is
                available.
              </Text>
            ) : null}

            <View style={styles.accountChoices}>
              {activeAccounts.map(
                (financeAccount) => {
                  const selected =
                    draft.financeAccountId ===
                    financeAccount.id;

                  return (
                    <Pressable
                      key={financeAccount.id}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          financeAccountId:
                            financeAccount.id,
                        }))
                      }
                      style={[
                        styles.accountChoice,
                        selected &&
                          styles.accountChoiceSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.accountChoiceName,
                          selected &&
                            styles.accountChoiceNameSelected,
                        ]}
                      >
                        {financeAccount.name}
                      </Text>

                      <Text
                        style={[
                          styles.accountChoiceMeta,
                          selected &&
                            styles.accountChoiceMetaSelected,
                        ]}
                      >
                        {financeAccount.accountType.toUpperCase()}{" "}
                        ·{" "}
                        {formatFinanceMoney(
                          financeAccount.balancePaise,
                        )}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            <Text style={styles.fieldLabel}>
              Amount
            </Text>

            <TextInput
              value={draft.amount}
              onChangeText={(amount) =>
                setDraft((current) => ({
                  ...current,
                  amount,
                }))
              }
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#929A96"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>
              Description
            </Text>

            <TextInput
              value={draft.description}
              onChangeText={(description) =>
                setDraft((current) => ({
                  ...current,
                  description,
                }))
              }
              multiline
              maxLength={2000}
              placeholder="What was this expense for?"
              placeholderTextColor="#929A96"
              style={[
                styles.input,
                styles.multilineInput,
              ]}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>
              Payee
            </Text>

            <TextInput
              value={draft.payee}
              onChangeText={(payee) =>
                setDraft((current) => ({
                  ...current,
                  payee,
                }))
              }
              maxLength={200}
              placeholder="Optional"
              placeholderTextColor="#929A96"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>
              Business date
            </Text>

            <TextInput
              value={draft.businessDate}
              onChangeText={(businessDate) =>
                setDraft((current) => ({
                  ...current,
                  businessDate:
                    formatIsoDateInput(
                      businessDate,
                      current.businessDate,
                    ),
                }))
              }
              keyboardType="number-pad"
              maxLength={10}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#929A96"
              style={styles.input}
            />

            {!isValidIsoDate(
              draft.businessDate,
            ) ? (
              <Text style={styles.errorCopy}>
                Enter a valid date as YYYY-MM-DD.
              </Text>
            ) : null}

            <Pressable
              disabled={
                !draftIsValid ||
                submitExpense.isPending ||
                activeAccounts.length === 0
              }
              onPress={() =>
                submitExpense.mutate()
              }
              style={[
                styles.primaryButton,
                (!draftIsValid ||
                  submitExpense.isPending ||
                  activeAccounts.length === 0) &&
                  styles.disabled,
              ]}
            >
              <Text
                style={styles.primaryButtonText}
              >
                {submitExpense.isPending
                  ? "Submitting..."
                  : "Submit expense"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Expense history
            </Text>

            <Text style={styles.help}>
              Newest submissions appear first.
            </Text>
          </View>

          <Pressable
            onPress={() => expenses.refetch()}
          >
            <Text style={styles.refreshAction}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {expenses.isLoading ? (
          <View style={styles.statePanel}>
            <ActivityIndicator
              color={colors.deepEmerald}
            />
            <Text style={styles.stateCopy}>
              Loading expenses...
            </Text>
          </View>
        ) : null}

        {expenses.isError ? (
          <View style={styles.statePanel}>
            <Text style={styles.errorCopy}>
              Finance expenses could not be loaded.
            </Text>

            <Pressable
              onPress={() => expenses.refetch()}
              style={styles.secondaryButton}
            >
              <Text
                style={styles.secondaryButtonText}
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!expenses.isLoading &&
        !expenses.isError &&
        (expenses.data?.length ?? 0) === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateCopy}>
              No Finance expenses have been
              recorded yet.
            </Text>
          </View>
        ) : null}

        {(expenses.data ?? []).map(
          (expense) => {
            const submittedByCurrentUser =
              expense
                .submittedByApplicationUserId ===
              account.id;

            const canDecide =
              access.canApproveFinanceExpenses &&
              expense.status === "submitted" &&
              !submittedByCurrentUser;

            const rejecting =
              rejectingExpenseId ===
              expense.id;

            return (
              <View
                key={expense.id}
                style={styles.expenseCard}
              >
                <View
                  style={styles.cardTopRow}
                >
                  <View style={styles.cardTopCopy}>
                    <Text
                      style={styles.expenseDescription}
                    >
                      {expense.description}
                    </Text>

                    <Text style={styles.meta}>
                      {expense.businessDate}
                    </Text>
                  </View>

                  <Text
                    style={styles.expenseAmount}
                  >
                    {formatFinanceMoney(
                      expense.amountPaise,
                    )}
                  </Text>
                </View>

                <View style={styles.statusRow}>
                  <Text
                    style={[
                      styles.statusBadge,
                      expense.status ===
                        "posted" &&
                        styles.statusPosted,
                      expense.status ===
                        "rejected" &&
                        styles.statusRejected,
                    ]}
                  >
                    {financeExpenseStatusLabel(
                      expense.status,
                    )}
                  </Text>

                  <Text style={styles.meta}>
                    {accountNames.get(
                      expense.financeAccountId,
                    ) ??
                      "Finance account"}
                  </Text>
                </View>

                {expense.payee ? (
                  <Text style={styles.detail}>
                    Payee: {expense.payee}
                  </Text>
                ) : null}

                <Text style={styles.detail}>
                  {submittedByCurrentUser
                    ? "Submitted by you"
                    : "Submitted by another authorized user"}
                </Text>

                {expense.status ===
                  "rejected" &&
                expense.rejectionReason ? (
                  <View
                    style={styles.rejectionBox}
                  >
                    <Text
                      style={styles.rejectionTitle}
                    >
                      Rejection reason
                    </Text>
                    <Text
                      style={styles.rejectionCopy}
                    >
                      {expense.rejectionReason}
                    </Text>
                  </View>
                ) : null}

                {expense.status ===
                  "submitted" &&
                submittedByCurrentUser ? (
                  <Text style={styles.notice}>
                    Maker/checker control: another
                    authorized Finance user must
                    decide this expense.
                  </Text>
                ) : null}

                {expense.status ===
                  "submitted" &&
                !submittedByCurrentUser &&
                !access.canApproveFinanceExpenses ? (
                  <Text style={styles.notice}>
                    Awaiting review by an authorized
                    Finance approver.
                  </Text>
                ) : null}

                {canDecide ? (
                  <>
                    <View
                      style={styles.actionRow}
                    >
                      <Pressable
                        disabled={
                          decideExpense.isPending
                        }
                        onPress={() =>
                          confirmApprove(expense)
                        }
                        style={[
                          styles.approveButton,
                          decideExpense.isPending &&
                            styles.disabled,
                        ]}
                      >
                        <Text
                          style={
                            styles.approveButtonText
                          }
                        >
                          Approve
                        </Text>
                      </Pressable>

                      <Pressable
                        disabled={
                          decideExpense.isPending
                        }
                        onPress={() => {
                          if (rejecting) {
                            setRejectingExpenseId(
                              null,
                            );
                            setRejectionReason("");
                          } else {
                            setRejectingExpenseId(
                              expense.id,
                            );
                            setRejectionReason("");
                          }
                        }}
                        style={[
                          styles.rejectButton,
                          decideExpense.isPending &&
                            styles.disabled,
                        ]}
                      >
                        <Text
                          style={
                            styles.rejectButtonText
                          }
                        >
                          {rejecting
                            ? "Cancel rejection"
                            : "Reject"}
                        </Text>
                      </Pressable>
                    </View>

                    {rejecting ? (
                      <View
                        style={
                          styles.rejectPanel
                        }
                      >
                        <Text
                          style={
                            styles.fieldLabel
                          }
                        >
                          Rejection reason
                        </Text>

                        <TextInput
                          value={
                            rejectionReason
                          }
                          onChangeText={
                            setRejectionReason
                          }
                          multiline
                          maxLength={2000}
                          placeholder="Why is this expense being rejected?"
                          placeholderTextColor="#929A96"
                          style={[
                            styles.input,
                            styles.multilineInput,
                          ]}
                          textAlignVertical="top"
                        />

                        <Pressable
                          disabled={
                            !rejectionReason.trim() ||
                            decideExpense.isPending
                          }
                          onPress={() =>
                            confirmReject(expense)
                          }
                          style={[
                            styles.confirmRejectButton,
                            (!rejectionReason.trim() ||
                              decideExpense.isPending) &&
                              styles.disabled,
                          ]}
                        >
                          <Text
                            style={
                              styles.confirmRejectButtonText
                            }
                          >
                            Confirm rejection
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
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
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  summaryValue: {
    color: colors.deepEmerald,
    fontSize: 22,
    fontWeight: "800",
  },
  summaryLabel: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 22,
    padding: 18,
  },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  help: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
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
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 96,
  },
  accountChoices: {
    gap: 8,
    marginTop: 10,
  },
  accountChoice: {
    borderColor: colors.sand,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  accountChoiceSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  accountChoiceName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  accountChoiceNameSelected: {
    color: "#FFFFFF",
  },
  accountChoiceMeta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 3,
  },
  accountChoiceMetaSelected: {
    color: "#E8F0EC",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
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
    marginTop: 8,
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
  expenseCard: {
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
    gap: 12,
    justifyContent: "space-between",
  },
  cardTopCopy: {
    flex: 1,
  },
  expenseDescription: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  expenseAmount: {
    color: colors.deepEmerald,
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  statusBadge: {
    backgroundColor: "#F5E7B8",
    borderRadius: 999,
    color: "#6E5714",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPosted: {
    backgroundColor: "#DDEDE5",
    color: colors.deepEmerald,
  },
  statusRejected: {
    backgroundColor: "#F4DDDD",
    color: "#8F2F2F",
  },
  detail: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  notice: {
    color: colors.secondary,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 12,
  },
  rejectionBox: {
    backgroundColor: "#FBF1F1",
    borderRadius: 10,
    marginTop: 12,
    padding: 12,
  },
  rejectionTitle: {
    color: "#8F2F2F",
    fontSize: 12,
    fontWeight: "800",
  },
  rejectionCopy: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  approveButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 9,
    flex: 1,
    paddingVertical: 11,
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  rejectButton: {
    alignItems: "center",
    borderColor: "#9B2C2C",
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  rejectButtonText: {
    color: "#9B2C2C",
    fontSize: 13,
    fontWeight: "800",
  },
  rejectPanel: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 2,
  },
  confirmRejectButton: {
    alignItems: "center",
    backgroundColor: "#9B2C2C",
    borderRadius: 9,
    marginTop: 12,
    paddingVertical: 12,
  },
  confirmRejectButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
