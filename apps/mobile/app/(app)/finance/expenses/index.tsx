import { useRef, useState } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "../../../../src/auth/AuthProvider";
import {
  FinancePageHeader,
  FinanceStatusChip,
} from "../../../../src/components/FinanceUI";
import { Screen } from "../../../../src/components/Screen";
import {
  formatIsoDateInput,
  isValidIsoDate,
} from "../../../../src/lib/date-input";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import { parseRupeesToPaise } from "../../../../src/modules/donation-presentation";
import {
  type FinanceExpense,
  closeFinanceExpense,
  decideFinanceExpense,
  explainMissingFinanceExpenseBill,
  financeExpenseBillSignedUrl,
  financeExpensesQueryKey,
  financeExpenseStatusLabel,
  formatFinanceMoney,
  listExpensePaymentAccounts,
  listFinanceExpenses,
  listFinanceExpenseBills,
  listFinanceExpenseRevisions,
  payFinanceExpense,
  resubmitFinanceExpense,
  submitFinanceExpense,
  uploadFinanceExpenseBill,
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
      return "The expense decision failed. Refresh and check your approval access.";

    case "finance_expense_missing_bill_reason_invalid":
      return "Explain why there is no bill in at least 10 characters.";

    case "finance_expense_close_reason_invalid":
      return "Explain why the approved remainder will not be paid (10–1000 characters).";

    case "finance_expense_resubmit_failed":
      return "Could not resubmit. Check that this is your rejected request and refresh.";

    case "finance_expense_close_failed":
      return "The expense could not be closed. Refresh and check its status.";

    case "finance_expense_payment_failed":
      return "Payment failed. Check the approved balance, Finance account, and your payment access.";

    default:
      return "The Finance expense operation could not be completed.";
  }
}

export default function FinanceExpensesScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    financeAccountId: "",
    amount: "",
    description: "",
    payee: "",
    businessDate: localIsoDate(),
    missingBillReason: "",
  });

  const [rejectingExpenseId, setRejectingExpenseId] =
    useState<string | null>(null);

  const [rejectionReason, setRejectionReason] =
    useState("");
  const [payingExpenseId, setPayingExpenseId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(localIsoDate());
  const [reasonExpenseId, setReasonExpenseId] = useState<string | null>(null);
  const [missingBillReason, setMissingBillReason] = useState("");
  const [closingExpenseId, setClosingExpenseId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const access = capabilities.data;

  const canAccessExpenses =
    access?.canReadFinanceTransactions === true ||
    access?.canCreateFinanceExpenses === true ||
    access?.canApproveFinanceExpenses === true ||
    access?.canPayFinanceExpenses === true;

  const expenseKey = financeExpensesQueryKey(
    account?.id,
  );

  const expenses = useQuery({
    queryKey: expenseKey,
    queryFn: listFinanceExpenses,
    enabled: Boolean(account && canAccessExpenses),
  });

  const revisions = useQuery({
    queryKey: ["finance", "expense-revisions", account?.id],
    queryFn: listFinanceExpenseRevisions,
    enabled: Boolean(account && canAccessExpenses),
  });

  const bills = useQuery({
    queryKey: ["finance", "expense-bills", account?.id],
    queryFn: listFinanceExpenseBills,
    enabled: Boolean(account && canAccessExpenses),
  });

  const accounts = useQuery({
    queryKey: ["finance", "expense-payment-accounts", account?.id],
    queryFn: listExpensePaymentAccounts,
    enabled: Boolean(account && canAccessExpenses),
  });

  const activeAccounts = accounts.data ?? [];
  const accountNames = new Map(activeAccounts.map((item) => [item.id, item.name]));

  const parsedAmount =
    parseRupeesToPaise(draft.amount);

  const draftIsValid =
    Boolean(draft.financeAccountId) &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    draft.description.trim().length > 0 &&
    draft.description.trim().length <= 2000 &&
    draft.payee.trim().length <= 200 &&
    isValidIsoDate(draft.businessDate) &&
    (draft.missingBillReason.trim().length === 0 ||
      (draft.missingBillReason.trim().length >= 10 && draft.missingBillReason.trim().length <= 1000));

  const submitExpense = useMutation({
    mutationFn: () =>
      (editingExpenseId ? resubmitFinanceExpense({
        financeExpenseId: editingExpenseId,
        financeAccountId: draft.financeAccountId,
        amount: draft.amount,
        description: draft.description,
        payee: draft.payee,
        businessDate: draft.businessDate,
        missingBillReason: draft.missingBillReason,
      }) : submitFinanceExpense({
        financeAccountId:
          draft.financeAccountId,
        amount: draft.amount,
        description: draft.description,
        payee: draft.payee,
        businessDate: draft.businessDate,
        missingBillReason: draft.missingBillReason,
      })),

    onSuccess: async () => {
      const wasRevision = Boolean(editingExpenseId);
      setEditingExpenseId(null);
      setDraft({
        financeAccountId: "",
        amount: "",
        description: "",
        payee: "",
        businessDate: localIsoDate(),
        missingBillReason: "",
      });

      await Promise.all([expenses.refetch(), revisions.refetch(), bills.refetch()]);

      Alert.alert(
        wasRevision ? "Expense resubmitted" : "Expense submitted",
        "Attach a bill for this revision or record why there is none before approval.",
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

  const payExpense = useMutation({
    mutationFn: payFinanceExpense,
    onSuccess: async () => {
      setPayingExpenseId(null);
      setPaymentAmount("");
      await expenses.refetch();
      await queryClient.invalidateQueries({ queryKey: ["finance", "accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] });
      Alert.alert("Payment recorded", "The paid amount is now in the transaction ledger.");
    },
    onError: (error) => Alert.alert("Payment failed", expenseErrorMessage(error)),
  });

  const closeExpense = useMutation({
    mutationFn: closeFinanceExpense,
    onSuccess: async () => {
      setClosingExpenseId(null);
      setCloseReason("");
      await expenses.refetch();
      Alert.alert("Expense closed", "The unused approval was recorded without another payment.");
    },
    onError: (error) => Alert.alert("Close failed", expenseErrorMessage(error)),
  });

  const attachBill = useMutation({
    mutationFn: async (expenseId: string) => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return false;
      await uploadFinanceExpenseBill(expenseId, result.assets[0]);
      return true;
    },
    onSuccess: async (uploaded) => {
      if (uploaded) {
        await bills.refetch();
        Alert.alert("Bill attached", "The bill is available for authorized review.");
      }
    },
    onError: () => Alert.alert("Bill upload failed", "Choose a JPEG, PNG, or PDF up to 5 MiB and retry."),
  });

  const explainBill = useMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      explainMissingFinanceExpenseBill(expenseId, reason),
    onSuccess: async () => {
      setReasonExpenseId(null);
      setMissingBillReason("");
      await expenses.refetch();
    },
    onError: (error) => Alert.alert("Reason not saved", expenseErrorMessage(error)),
  });

  async function viewBill(path: string) {
    try {
      await Linking.openURL(await financeExpenseBillSignedUrl(path));
    } catch {
      Alert.alert("Bill unavailable", "The private bill could not be opened.");
    }
  }

  function confirmApprove(
    expense: FinanceExpense,
  ) {
    const hasBill = bills.data?.some((bill) =>
      bill.financeExpenseId === expense.id && bill.revisionNumber === expense.revisionNumber);
    if (!hasBill && !expense.missingBillReason) {
      Alert.alert("Evidence required", "Attach a bill or record a missing-bill reason before approval.");
      return;
    }
    Alert.alert(
      "Approve expense?",
      `Approve ${formatFinanceMoney(
        expense.amountPaise,
      )} for ${expense.description}? The Treasurer will record the payment separately. Approval does not change the account balance.`,
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
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void expenses.refetch();
              void bills.refetch();
              void revisions.refetch();

              void accounts.refetch();
            }}
            tintColor={colors.deepEmerald}
          />
        }
      >
        <FinancePageHeader
          title="Expenses"
          description="Submit expenses, approve requests, and record payments separately."
        />

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
              {editingExpenseId ? "Edit rejected expense" : "Submit expense"}
            </Text>

            {editingExpenseId ? (
              <Pressable accessibilityRole="button" onPress={() => {
                setEditingExpenseId(null);
                setDraft({ financeAccountId: "", amount: "", description: "", payee: "",
                  businessDate: localIsoDate(), missingBillReason: "" });
              }}><Text style={styles.refreshAction}>Cancel editing</Text></Pressable>
            ) : null}
            <Text style={styles.help}>
              Submission and approval do not reduce
              the account balance. Only a Treasurer
              payment records an outflow.
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
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
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
                        {financeAccount.accountType.toUpperCase()}
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

            <Text style={styles.fieldLabel}>No bill? Explain why</Text>
            <TextInput
              value={draft.missingBillReason}
              onChangeText={(missingBillReason) => setDraft((current) => ({ ...current, missingBillReason }))}
              multiline
              maxLength={1000}
              placeholder="Optional when you will attach a bill after submission"
              placeholderTextColor="#929A96"
              style={[styles.input, styles.multilineInput]}
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
              accessibilityRole="button"
              accessibilityState={{
                disabled:
                  !draftIsValid ||
                  submitExpense.isPending ||
                  activeAccounts.length === 0,
              }}
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
                  : editingExpenseId ? "Resubmit for approval" : "Submit expense"}
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
            accessibilityRole="button"
            onPress={() => expenses.refetch()}
          >
            <Text style={styles.refreshAction}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {expenses.isLoading ? (
          <View
            accessible
            accessibilityLabel="Loading Finance expenses..."
            accessibilityRole="progressbar"
            style={styles.statePanel}
          >
            <ActivityIndicator
              color={colors.deepEmerald}
            />

            <Text style={styles.stateCopy}>
              Loading expenses...
            </Text>
          </View>
        ) : null}

        {expenses.isError ? (
          <View
            accessible
            accessibilityRole="alert"
            style={styles.statePanel}
          >
            <Text style={styles.errorCopy}>
              Finance expenses could not be loaded.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => expenses.refetch()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
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
              expense.status === "submitted";

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
                    <FinanceStatusChip
                      label={financeExpenseStatusLabel(
                        expense.status,
                      )}
                      status={expense.status}
                    />

                    <Text style={styles.meta}>
                    {accountNames.get(
                      expense.financeAccountId,
                    ) ??
                      "Finance account"}
                  </Text>
                </View>

                {(expense.status === "approved" || expense.status === "partially_paid" || expense.status === "posted" || expense.status === "closed") ? (
                  <Text style={styles.detail}>
                    Paid {formatFinanceMoney(expense.paidAmountPaise)} of {formatFinanceMoney(expense.amountPaise)}
                  </Text>
                ) : null}

                {expense.status === "closed" ? (
                  <Text style={styles.detail}>
                    Unused approval: {formatFinanceMoney(expense.amountPaise - expense.paidAmountPaise)}
                    {expense.closeReason ? ` · ${expense.closeReason}` : ""}
                  </Text>
                ) : null}

                {(bills.data ?? []).filter((bill) => bill.financeExpenseId === expense.id).map((bill) => (
                  <Pressable key={bill.id} accessibilityRole="button" onPress={() => void viewBill(bill.storageObjectPath)}>
                    <Text style={styles.refreshAction}>
                      View private bill · revision {bill.revisionNumber} · {bill.createdAt.slice(0, 10)}
                    </Text>
                  </Pressable>
                ))}
                {(revisions.data ?? []).filter((item) => item.financeExpenseId === expense.id).map((item) => (
                  <Text key={item.id} style={styles.detail}>
                    Revision {item.revisionNumber}: rejected {item.decidedAt.slice(0, 10)} · {item.rejectionReason}
                  </Text>
                ))}
                {expense.missingBillReason ? (
                  <Text style={styles.detail}>No bill: {expense.missingBillReason}</Text>
                ) : null}
                {expense.status === "rejected" && submittedByCurrentUser && access.canCreateFinanceExpenses ? (
                  <Pressable accessibilityRole="button" onPress={() => {
                    setEditingExpenseId(expense.id);
                    setDraft({
                      financeAccountId: expense.financeAccountId,
                      amount: (expense.amountPaise / 100).toFixed(2),
                      description: expense.description,
                      payee: expense.payee ?? "",
                      businessDate: expense.businessDate,
                      missingBillReason: expense.missingBillReason ?? "",
                    });
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Edit and resubmit</Text>
                  </Pressable>
                ) : null}

                {expense.status === "submitted" && submittedByCurrentUser ? (
                  <View style={styles.rejectionBox}>
                    <Pressable accessibilityRole="button" disabled={attachBill.isPending}
                      onPress={() => attachBill.mutate(expense.id)} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>
                        {attachBill.isPending ? "Uploading..." : "Attach bill (JPEG, PNG, PDF)"}
                      </Text>
                    </Pressable>
                    {!expense.missingBillReason && reasonExpenseId !== expense.id ? (
                      <Pressable accessibilityRole="button" onPress={() => setReasonExpenseId(expense.id)}>
                        <Text style={styles.refreshAction}>Explain missing bill</Text>
                      </Pressable>
                    ) : null}
                    {reasonExpenseId === expense.id && !expense.missingBillReason ? (
                      <>
                        <TextInput value={missingBillReason} onChangeText={setMissingBillReason}
                          multiline maxLength={1000} placeholder="Why is no bill available?"
                          style={[styles.input, styles.multilineInput]} />
                        <Pressable accessibilityRole="button"
                          disabled={explainBill.isPending || missingBillReason.trim().length < 10}
                          onPress={() => explainBill.mutate({ expenseId: expense.id, reason: missingBillReason })}
                          style={styles.secondaryButton}>
                          <Text style={styles.secondaryButtonText}>Save explanation</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                ) : null}

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

                {expense.status === "submitted" && !access.canApproveFinanceExpenses ? (
                  <Text style={styles.notice}>Awaiting President or Vice President approval.</Text>
                ) : null}

                {access.canPayFinanceExpenses &&
                  (expense.status === "approved" || expense.status === "partially_paid") ? (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionTitle}>
                      Remaining {formatFinanceMoney(expense.amountPaise - expense.paidAmountPaise)}
                    </Text>
                    {payingExpenseId === expense.id ? (
                      <>
                        <TextInput
                          value={paymentAmount}
                          onChangeText={setPaymentAmount}
                          keyboardType="decimal-pad"
                          placeholder="Payment amount in rupees"
                          style={styles.input}
                        />
                        <TextInput
                          value={paymentDate}
                          onChangeText={(value) => setPaymentDate(formatIsoDateInput(value, paymentDate))}
                          keyboardType="number-pad"
                          placeholder="YYYY-MM-DD"
                          style={styles.input}
                        />
                        <Pressable
                          accessibilityRole="button"
                          disabled={payExpense.isPending || !isValidIsoDate(paymentDate) ||
                            (parseRupeesToPaise(paymentAmount) ?? 0) <= 0 ||
                            (parseRupeesToPaise(paymentAmount) ?? 0) > expense.amountPaise - expense.paidAmountPaise}
                          onPress={() => Alert.alert("Record payment?",
                            `Record ${paymentAmount} rupees as paid from this Finance account?`, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Record", onPress: () => payExpense.mutate({
                                financeExpenseId: expense.id, amount: paymentAmount, businessDate: paymentDate,
                              }) },
                            ])}
                          style={styles.secondaryButton}
                        >
                          <Text style={styles.secondaryButtonText}>Record payment</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={() => {
                        setPayingExpenseId(expense.id);
                        setPaymentAmount("");
                        setPaymentDate(localIsoDate());
                      }} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Pay expense</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {access.canPayFinanceExpenses && expense.status === "partially_paid" ? (
                  <View style={styles.rejectionBox}>
                    {closingExpenseId === expense.id ? (
                      <>
                        <Text style={styles.rejectionTitle}>Close with unused approval</Text>
                        <TextInput value={closeReason} onChangeText={setCloseReason}
                          multiline maxLength={1000} placeholder="Why will the remainder not be paid?"
                          style={[styles.input, styles.multilineInput]} />
                        <Pressable accessibilityRole="button"
                          disabled={closeExpense.isPending || closeReason.trim().length < 10}
                          onPress={() => Alert.alert("Close expense?",
                            `Keep ${formatFinanceMoney(expense.paidAmountPaise)} as paid and close ${formatFinanceMoney(expense.amountPaise - expense.paidAmountPaise)} as unused?`, [
                              { text: "Cancel", style: "cancel" },
                              { text: "Close", onPress: () => closeExpense.mutate({
                                financeExpenseId: expense.id, reason: closeReason,
                              }) },
                            ])} style={styles.secondaryButton}>
                          <Text style={styles.secondaryButtonText}>Confirm closure</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={() => {
                        setClosingExpenseId(expense.id);
                        setCloseReason("");
                      }} style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Close unpaid remainder</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {canDecide ? (
                  <>
                    <View
                      style={styles.actionRow}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: decideExpense.isPending,
                        }}
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
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: decideExpense.isPending,
                        }}
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
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled:
                              !rejectionReason.trim() ||
                              decideExpense.isPending,
                          }}
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
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  cardTopCopy: {
    flex: 1,
    minWidth: "60%",
  },
  expenseDescription: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  expenseAmount: {
    color: colors.deepEmerald,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
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
