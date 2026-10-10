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
  type FinanceAdjustment,
  type FinanceAdjustmentType,
  type FinanceTransactionDirection,
  canCorrectFinanceTransaction,
  canReverseFinanceTransaction,
  decideFinanceAdjustment,
  financeAccountsQueryKey,
  financeAdjustmentsQueryKey,
  financeAdjustmentStatusLabel,
  financeAdjustmentTypeLabel,
  financeTransactionCategoryLabel,
  financeTransactionsQueryKey,
  formatFinanceMoney,
  listFinanceAccounts,
  listFinanceAdjustments,
  listFinanceTransactions,
  signedFinanceTransactionAmount,
  submitFinanceCorrection,
  submitFinanceReversal,
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

function shortId(value: string) {
  if (value.length <= 12) return value;

  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function adjustmentErrorMessage(error: Error) {
  switch (error.message) {
    case "finance_adjustment_target_required":
      return "Select the Finance transaction that needs adjustment.";

    case "finance_adjustment_reason_invalid":
      return "Enter an adjustment reason of 2000 characters or fewer.";

    case "finance_adjustment_business_date_invalid":
      return "Enter a valid business date as YYYY-MM-DD.";

    case "finance_correction_account_required":
      return "Select the Finance account that should receive the correction effect.";

    case "finance_correction_direction_invalid":
      return "Select whether the correction is an inflow or outflow.";

    case "finance_correction_amount_invalid":
      return "Enter a valid correction amount greater than ₹0.";

    case "finance_adjustment_rejection_reason_required":
      return "A rejection reason is required.";

    case "finance_adjustment_decision_reason_invalid":
      return "Decision reason must be 2000 characters or fewer.";

    case "finance_correction_submit_failed":
      return "The correction could not be submitted. The target may be ineligible, or the selected account may no longer be active.";

    case "finance_reversal_submit_failed":
      return "The reversal could not be submitted. Transfer entries, reversals, and transactions with an existing active reversal are not eligible.";

    case "finance_adjustment_decide_failed":
      return "The adjustment could not be approved or rejected. Check its current state, maker/checker rule, permission, and Finance account status.";

    default:
      return "The Finance adjustment operation could not be completed.";
  }
}

export default function FinanceAdjustmentsScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  const [requestedType, setRequestedType] =
    useState<FinanceAdjustmentType>(
      "correction",
    );

  const [
    selectedTargetTransactionId,
    setSelectedTargetTransactionId,
  ] = useState("");

  const [
    correctionFinanceAccountId,
    setCorrectionFinanceAccountId,
  ] = useState("");

  const [
    correctionDirection,
    setCorrectionDirection,
  ] =
    useState<FinanceTransactionDirection>(
      "inflow",
    );

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [businessDate, setBusinessDate] =
    useState(localIsoDate());

  const [
    rejectingAdjustmentId,
    setRejectingAdjustmentId,
  ] = useState<string | null>(null);

  const [rejectionReason, setRejectionReason] =
    useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const access = capabilities.data;

  const canAccessWorkspace =
    access?.canReadFinanceTransactions === true ||
    access?.canCreateFinanceCorrections ===
      true ||
    access?.canCreateFinanceReversals === true;

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

  const adjustments = useQuery({
    queryKey: financeAdjustmentsQueryKey(
      account?.id,
    ),
    queryFn: listFinanceAdjustments,
    enabled: Boolean(
      account && canAccessWorkspace,
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

  const adjustmentType: FinanceAdjustmentType =
    access?.canCreateFinanceCorrections
      ? requestedType
      : "reversal";

  const activeAccounts = useMemo(
    () =>
      (accounts.data ?? []).filter(
        (financeAccount) =>
          financeAccount.status === "active",
      ),
    [accounts.data],
  );

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

  const activeReversalTargetIds =
    useMemo(
      () =>
        new Set(
          (adjustments.data ?? [])
            .filter(
              (adjustment) =>
                adjustment.adjustmentType ===
                  "reversal" &&
                (adjustment.status ===
                  "submitted" ||
                  adjustment.status ===
                    "applied"),
            )
            .map(
              (adjustment) =>
                adjustment.targetTransactionId,
            ),
        ),
      [adjustments.data],
    );

  const eligibleTransactions = useMemo(
    () =>
      (transactions.data ?? []).filter(
        (transaction) => {
          if (
            adjustmentType === "correction"
          ) {
            return canCorrectFinanceTransaction(
              transaction,
            );
          }

          return (
            canReverseFinanceTransaction(
              transaction,
            ) &&
            !activeReversalTargetIds.has(
              transaction.id,
            )
          );
        },
      ),
    [
      activeReversalTargetIds,
      adjustmentType,
      transactions.data,
    ],
  );

  const selectedTarget =
    transactions.data?.find(
      (transaction) =>
        transaction.id ===
        selectedTargetTransactionId,
    ) ?? null;

  const parsedCorrectionAmount =
    parseRupeesToPaise(amount);

  const correctionDraftValid =
    adjustmentType === "correction" &&
    Boolean(selectedTarget) &&
    Boolean(correctionFinanceAccountId) &&
    (correctionDirection === "inflow" ||
      correctionDirection === "outflow") &&
    parsedCorrectionAmount !== null &&
    parsedCorrectionAmount > 0 &&
    reason.trim().length > 0 &&
    reason.trim().length <= 2000 &&
    isValidIsoDate(businessDate);

  const reversalDraftValid =
    adjustmentType === "reversal" &&
    Boolean(selectedTarget) &&
    reason.trim().length > 0 &&
    reason.trim().length <= 2000 &&
    isValidIsoDate(businessDate);

  function resetDraft() {
    setSelectedTargetTransactionId("");
    setCorrectionFinanceAccountId("");
    setCorrectionDirection("inflow");
    setAmount("");
    setReason("");
    setBusinessDate(localIsoDate());
  }

  function changeAdjustmentType(
    type: FinanceAdjustmentType,
  ) {
    setRequestedType(type);
    resetDraft();
  }

  const submitAdjustment = useMutation({
    mutationFn: async () => {
      if (!selectedTarget) {
        throw new Error(
          "finance_adjustment_target_required",
        );
      }

      if (adjustmentType === "correction") {
        return submitFinanceCorrection({
          targetTransactionId:
            selectedTarget.id,
          reason,
          correctionFinanceAccountId,
          correctionDirection,
          amount,
          businessDate,
        });
      }

      return submitFinanceReversal({
        targetTransactionId:
          selectedTarget.id,
        reason,
        businessDate,
      });
    },

    onSuccess: async (adjustment) => {
      resetDraft();

      await adjustments.refetch();

      Alert.alert(
        `${
          financeAdjustmentTypeLabel(
            adjustment.adjustmentType,
          )
        } submitted`,
        "Another authorized Finance user must review this request before any new ledger effect is posted.",
      );
    },

    onError: (error) => {
      Alert.alert(
        "Adjustment could not be submitted",
        adjustmentErrorMessage(error),
      );
    },
  });

  const decideAdjustment = useMutation({
    mutationFn: decideFinanceAdjustment,

    onSuccess: async (adjustment) => {
      setRejectingAdjustmentId(null);
      setRejectionReason("");

      await adjustments.refetch();

      if (adjustment.status === "applied") {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: [
              "finance",
              "transactions",
            ],
          }),
          queryClient.invalidateQueries({
            queryKey: [
              "finance",
              "accounts",
            ],
          }),
        ]);
      }
    },

    onError: (error) => {
      Alert.alert(
        "Adjustment decision failed",
        adjustmentErrorMessage(error),
      );
    },
  });

  function canDecideAdjustment(
    adjustment: FinanceAdjustment,
  ) {
    if (
      adjustment.status !== "submitted" ||
      adjustment
        .submittedByApplicationUserId ===
        account?.id
    ) {
      return false;
    }

    if (
      adjustment.adjustmentType ===
      "correction"
    ) {
      return (
        access?.canCreateFinanceCorrections ===
        true
      );
    }

    return (
      access?.canCreateFinanceReversals ===
      true
    );
  }

  function confirmApprove(
    adjustment: FinanceAdjustment,
  ) {
    const isReversal =
      adjustment.adjustmentType ===
      "reversal";

    Alert.alert(
      `Approve ${
        isReversal ? "reversal" : "correction"
      }?`,
      isReversal
        ? "Approval will create a new ledger transaction with the exact opposite effect of the target transaction. The original transaction remains unchanged."
        : "Approval will create a new CORRECTION ledger transaction. The original transaction remains unchanged.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Approve",
          onPress: () =>
            decideAdjustment.mutate({
              financeAdjustmentId:
                adjustment.id,
              decision: "approve",
            }),
        },
      ],
    );
  }

  function confirmReject(
    adjustment: FinanceAdjustment,
  ) {
    const normalizedReason =
      rejectionReason.trim();

    if (!normalizedReason) {
      Alert.alert(
        "Rejection reason required",
        "Enter why this Finance adjustment is being rejected.",
      );
      return;
    }

    Alert.alert(
      `Reject ${financeAdjustmentTypeLabel(
        adjustment.adjustmentType,
      ).toLowerCase()}?`,
      "No new Finance ledger effect will be posted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reject",
          style: "destructive",
          onPress: () =>
            decideAdjustment.mutate({
              financeAdjustmentId:
                adjustment.id,
              decision: "reject",
              reason: normalizedReason,
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
    !canAccessWorkspace
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
          Corrections & reversals
        </Text>

        <Text style={styles.stateCopy}>
          Finance adjustment access is not
          available for your account.
        </Text>
      </Screen>
    );
  }

  const canSubmitAnyAdjustment =
    access.canCreateFinanceCorrections ||
    access.canCreateFinanceReversals;

  const refreshing =
    adjustments.isRefetching ||
    transactions.isRefetching ||
    accounts.isRefetching;

  const pendingCount =
    adjustments.data?.filter(
      (adjustment) =>
        adjustment.status === "submitted",
    ).length ?? 0;

  const appliedCount =
    adjustments.data?.filter(
      (adjustment) =>
        adjustment.status === "applied",
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
              void adjustments.refetch();

              if (
                access.canReadFinanceTransactions
              ) {
                void transactions.refetch();
              }

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
        <FinancePageHeader
          title="Corrections & reversals"
          description="Correct Finance history through append-only ledger effects. Existing transactions remain unchanged."
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
              {appliedCount}
            </Text>

            <Text style={styles.summaryLabel}>
              Applied
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {adjustments.data?.length ?? 0}
            </Text>

            <Text style={styles.summaryLabel}>
              Total
            </Text>
          </View>
        </View>

        {canSubmitAnyAdjustment ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              Submit adjustment
            </Text>

            <Text style={styles.help}>
              Submission alone does not change
              the ledger. Another authorized
              Finance user must approve it.
            </Text>

            {access.canCreateFinanceCorrections &&
            access.canCreateFinanceReversals ? (
              <>
                <Text style={styles.fieldLabel}>
                  Adjustment type
                </Text>

                <View style={styles.typeRow}>
                  {(
                    [
                      "correction",
                      "reversal",
                    ] as FinanceAdjustmentType[]
                  ).map((type) => {
                    const selected =
                      adjustmentType === type;

                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() =>
                          changeAdjustmentType(
                            type,
                          )
                        }
                        style={[
                          styles.typeButton,
                          selected &&
                            styles.typeButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            selected &&
                              styles.typeButtonTextSelected,
                          ]}
                        >
                          {financeAdjustmentTypeLabel(
                            type,
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>
                {adjustmentType === "correction"
                  ? "Correction"
                  : "Reversal"}
              </Text>

              <Text style={styles.infoCopy}>
                {adjustmentType === "correction"
                  ? "A correction adds a new CORRECTION ledger effect. It does not replace or rewrite the selected transaction."
                  : "A reversal creates a new ledger transaction with the exact opposite account, direction and amount of the selected transaction."}
              </Text>
            </View>

            {transactions.isError ? (
              <Text style={styles.errorCopy}>
                Finance transactions could not
                be loaded. A transaction must be
                selected before submitting an
                adjustment.
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>
              Target transaction
            </Text>

            <Text style={styles.help}>
              Transfer-in and transfer-out rows
              are intentionally excluded from
              this generic adjustment workflow.
              Reversal rows also cannot be
              reversed again.
            </Text>

            {transactions.isLoading ? (
              <ActivityIndicator
                color={colors.deepEmerald}
                style={styles.inlineLoader}
              />
            ) : null}

            {!transactions.isLoading &&
            eligibleTransactions.length === 0 ? (
              <Text style={styles.notice}>
                No eligible Finance transactions
                are currently available for this
                adjustment type.
              </Text>
            ) : null}

            <View
              style={styles.transactionChoices}
            >
              {eligibleTransactions.map(
                (transaction) => {
                  const selected =
                    selectedTargetTransactionId ===
                    transaction.id;

                  const signedAmount =
                    signedFinanceTransactionAmount(
                      transaction,
                    );

                  return (
                    <Pressable accessibilityRole="button"
                      key={transaction.id}
                      onPress={() =>
                        setSelectedTargetTransactionId(
                          transaction.id,
                        )
                      }
                      style={[
                        styles.transactionChoice,
                        selected &&
                          styles.transactionChoiceSelected,
                      ]}
                    >
                      <View
                        style={
                          styles.transactionChoiceTop
                        }
                      >
                        <Text
                          style={[
                            styles.transactionChoiceTitle,
                            selected &&
                              styles.transactionChoiceTitleSelected,
                          ]}
                        >
                          {financeTransactionCategoryLabel(
                            transaction.transactionCategory,
                          )}
                        </Text>

                        <Text
                          style={[
                            styles.transactionChoiceAmount,
                            selected &&
                              styles.transactionChoiceTitleSelected,
                          ]}
                        >
                          {signedAmount >= 0
                            ? "+"
                            : ""}
                          {formatFinanceMoney(
                            signedAmount,
                          )}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.transactionChoiceMeta,
                          selected &&
                            styles.transactionChoiceMetaSelected,
                        ]}
                      >
                        {transaction.businessDate}
                        {" · "}
                        {accountNames.get(
                          transaction.financeAccountId,
                        ) ?? "Finance account"}
                        {" · "}
                        {shortId(transaction.id)}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            {selectedTarget ? (
              <View style={styles.selectedBox}>
                <Text
                  style={styles.selectedTitle}
                >
                  Selected transaction
                </Text>

                <Text
                  style={styles.selectedCopy}
                >
                  {financeTransactionCategoryLabel(
                    selectedTarget.transactionCategory,
                  )}
                  {" · "}
                  {selectedTarget.businessDate}
                  {" · "}
                  {shortId(selectedTarget.id)}
                </Text>
              </View>
            ) : null}

            {adjustmentType === "correction" ? (
              <>
                <Text style={styles.fieldLabel}>
                  Correction account
                </Text>

                {!access.canReadFinanceAccounts ? (
                  <Text
                    style={styles.errorCopy}
                  >
                    Finance account read access
                    is required to prepare a
                    correction effect.
                  </Text>
                ) : null}

                <View
                  style={styles.accountChoices}
                >
                  {activeAccounts.map(
                    (financeAccount) => {
                      const selected =
                        correctionFinanceAccountId ===
                        financeAccount.id;

                      return (
                        <Pressable accessibilityRole="button"
                          key={financeAccount.id}
                          onPress={() =>
                            setCorrectionFinanceAccountId(
                              financeAccount.id,
                            )
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
                  Correction direction
                </Text>

                <View style={styles.typeRow}>
                  {(
                    [
                      "inflow",
                      "outflow",
                    ] as FinanceTransactionDirection[]
                  ).map((direction) => {
                    const selected =
                      correctionDirection ===
                      direction;

                    return (
                      <Pressable accessibilityRole="button"
                        key={direction}
                        onPress={() =>
                          setCorrectionDirection(
                            direction,
                          )
                        }
                        style={[
                          styles.typeButton,
                          selected &&
                            styles.typeButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            selected &&
                              styles.typeButtonTextSelected,
                          ]}
                        >
                          {direction === "inflow"
                            ? "Inflow"
                            : "Outflow"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>
                  Correction amount
                </Text>

                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#929A96"
                  style={styles.input}
                />
              </>
            ) : null}

            <Text style={styles.fieldLabel}>
              Reason
            </Text>

            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={2000}
              placeholder={
                adjustmentType === "correction"
                  ? "Explain why this correction is required."
                  : "Explain why the original transaction must be reversed."
              }
              placeholderTextColor="#929A96"
              style={[
                styles.input,
                styles.multilineInput,
              ]}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>
              Business date
            </Text>

            <TextInput
              value={businessDate}
              onChangeText={(value) =>
                setBusinessDate((current) =>
                  formatIsoDateInput(
                    value,
                    current,
                  ),
                )
              }
              keyboardType="number-pad"
              maxLength={10}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#929A96"
              style={styles.input}
            />

            {!isValidIsoDate(
              businessDate,
            ) ? (
              <Text style={styles.errorCopy}>
                Enter a valid date as YYYY-MM-DD.
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
            disabled:
              submitAdjustment.isPending ||
              (adjustmentType === "correction"
                ? !correctionDraftValid
                : !reversalDraftValid),
          }}
              disabled={
                submitAdjustment.isPending ||
                (adjustmentType ===
                "correction"
                  ? !correctionDraftValid
                  : !reversalDraftValid)
              }
              onPress={() =>
                submitAdjustment.mutate()
              }
              style={[
                styles.primaryButton,
                (submitAdjustment.isPending ||
                  (adjustmentType ===
                  "correction"
                    ? !correctionDraftValid
                    : !reversalDraftValid)) &&
                  styles.disabled,
              ]}
            >
              <Text
                style={styles.primaryButtonText}
              >
                {submitAdjustment.isPending
                  ? "Submitting..."
                  : `Submit ${financeAdjustmentTypeLabel(
                      adjustmentType,
                    ).toLowerCase()}`}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>
              Adjustment history
            </Text>

            <Text style={styles.help}>
              Submitted, applied and rejected
              Finance adjustments remain in
              history.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              adjustments.refetch()
            }
          >
            <Text style={styles.refreshAction}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {adjustments.isLoading ? (
          <View
            accessible
            accessibilityLabel="Loading Finance adjustments..."
            accessibilityRole="progressbar"
            style={styles.statePanel}
          >
            <ActivityIndicator
              color={colors.deepEmerald}
            />

            <Text style={styles.stateCopy}>
              Loading Finance adjustments...
            </Text>
          </View>
        ) : null}

        {adjustments.isError ? (
          <View
            accessible
            accessibilityRole="alert"
            style={styles.statePanel}
          >
            <Text style={styles.errorCopy}>
              Finance adjustments could not be
              loaded.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                adjustments.refetch()
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

        {!adjustments.isLoading &&
        !adjustments.isError &&
        (adjustments.data?.length ?? 0) ===
          0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateCopy}>
              No Finance corrections or
              reversals have been submitted yet.
            </Text>
          </View>
        ) : null}

        {(adjustments.data ?? []).map(
          (adjustment) => {
            const submittedByCurrentUser =
              adjustment
                .submittedByApplicationUserId ===
              account.id;

            const canDecide =
              canDecideAdjustment(adjustment);

            const rejecting =
              rejectingAdjustmentId ===
              adjustment.id;

            const target =
              transactions.data?.find(
                (transaction) =>
                  transaction.id ===
                  adjustment.targetTransactionId,
              );

            return (
              <View
                key={adjustment.id}
                style={styles.adjustmentCard}
              >
                <View
                  style={styles.cardTopRow}
                >
                  <View style={styles.cardTopCopy}>
                    <Text
                      style={
                        styles.adjustmentTitle
                      }
                    >
                      {financeAdjustmentTypeLabel(
                        adjustment.adjustmentType,
                      )}
                    </Text>

                    <Text style={styles.meta}>
                      {adjustment.businessDate}
                      {" · Target "}
                      {shortId(
                        adjustment.targetTransactionId,
                      )}
                    </Text>
                  </View>

                  <FinanceStatusChip
                    label={financeAdjustmentStatusLabel(
                      adjustment.status,
                    )}
                    status={adjustment.status}
                  />
                </View>

                {target ? (
                  <View style={styles.targetBox}>
                    <Text
                      style={styles.targetTitle}
                    >
                      Target
                    </Text>

                    <Text
                      style={styles.targetCopy}
                    >
                      {financeTransactionCategoryLabel(
                        target.transactionCategory,
                      )}
                      {" · "}
                      {formatFinanceMoney(
                        signedFinanceTransactionAmount(
                          target,
                        ),
                      )}
                      {" · "}
                      {accountNames.get(
                        target.financeAccountId,
                      ) ?? "Finance account"}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.detail}>
                  Reason: {adjustment.reason}
                </Text>

                <Text style={styles.detail}>
                  {submittedByCurrentUser
                    ? "Submitted by you"
                    : "Submitted by another authorized user"}
                </Text>

                {adjustment.adjustmentType ===
                  "correction" ? (
                  <View
                    style={styles.effectBox}
                  >
                    <Text
                      style={styles.effectTitle}
                    >
                      Requested correction effect
                    </Text>

                    <Text
                      style={styles.effectCopy}
                    >
                      {adjustment.correctionDirection ===
                      "inflow"
                        ? "Inflow"
                        : "Outflow"}
                      {" · "}
                      {formatFinanceMoney(
                        adjustment.correctionAmountPaise ??
                          0,
                      )}
                      {" · "}
                      {accountNames.get(
                        adjustment.correctionFinanceAccountId ??
                          "",
                      ) ?? "Finance account"}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={styles.effectBox}
                  >
                    <Text
                      style={styles.effectTitle}
                    >
                      Reversal effect
                    </Text>

                    <Text
                      style={styles.effectCopy}
                    >
                      Server-calculated exact
                      opposite of the target
                      transaction.
                    </Text>
                  </View>
                )}

                {adjustment.status ===
                  "applied" &&
                adjustment.appliedTransactionId ? (
                  <Text style={styles.detail}>
                    Applied ledger transaction:{" "}
                    {shortId(
                      adjustment.appliedTransactionId,
                    )}
                  </Text>
                ) : null}

                {adjustment.status ===
                  "rejected" &&
                adjustment.rejectionReason ? (
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
                      {
                        adjustment.rejectionReason
                      }
                    </Text>
                  </View>
                ) : null}

                {adjustment.status ===
                  "submitted" &&
                submittedByCurrentUser ? (
                  <Text style={styles.notice}>
                    Maker/checker control: another
                    authorized Finance user must
                    decide this request.
                  </Text>
                ) : null}

                {canDecide ? (
                  <>
                    <View
                      style={styles.actionRow}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: decideAdjustment.isPending,
                        }}
                        disabled={
                          decideAdjustment.isPending
                        }
                        onPress={() =>
                          confirmApprove(
                            adjustment,
                          )
                        }
                        style={[
                          styles.approveButton,
                          decideAdjustment.isPending &&
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
                          disabled: decideAdjustment.isPending,
                        }}
                        disabled={
                          decideAdjustment.isPending
                        }
                        onPress={() => {
                          if (rejecting) {
                            setRejectingAdjustmentId(
                              null,
                            );
                            setRejectionReason("");
                          } else {
                            setRejectingAdjustmentId(
                              adjustment.id,
                            );
                            setRejectionReason("");
                          }
                        }}
                        style={[
                          styles.rejectButton,
                          decideAdjustment.isPending &&
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
                          placeholder="Why is this adjustment being rejected?"
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
                              decideAdjustment.isPending,
                          }}
                          disabled={
                            !rejectionReason.trim() ||
                            decideAdjustment.isPending
                          }
                          onPress={() =>
                            confirmReject(
                              adjustment,
                            )
                          }
                          style={[
                            styles.confirmRejectButton,
                            (!rejectionReason.trim() ||
                              decideAdjustment.isPending) &&
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
  typeRow: {
    flexDirection: "row",
    gap: 9,
  },
  typeButton: {
    alignItems: "center",
    borderColor: colors.sand,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  typeButtonSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  typeButtonText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "700",
  },
  typeButtonTextSelected: {
    color: "#FFFFFF",
  },
  infoBox: {
    backgroundColor: "#EEF5F1",
    borderColor: "#BCD3C5",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    padding: 12,
  },
  infoTitle: {
    color: colors.deepEmerald,
    fontSize: 12,
    fontWeight: "800",
  },
  infoCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  transactionChoices: {
    gap: 8,
    marginTop: 10,
  },
  transactionChoice: {
    borderColor: colors.sand,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  transactionChoiceSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  transactionChoiceTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  transactionChoiceTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  transactionChoiceAmount: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "800",
  },
  transactionChoiceTitleSelected: {
    color: "#FFFFFF",
  },
  transactionChoiceMeta: {
    color: colors.secondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  transactionChoiceMetaSelected: {
    color: "#DDE9E2",
  },
  selectedBox: {
    backgroundColor: "#F7F5EF",
    borderRadius: 9,
    marginTop: 12,
    padding: 11,
  },
  selectedTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  selectedCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  accountChoices: {
    gap: 8,
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
    color: "#DDE9E2",
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
  inlineLoader: {
    marginTop: 14,
  },
  errorCopy: {
    color: "#9B2C2C",
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
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 28,
  },
  sectionHeaderCopy: {
    flex: 1,
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
  adjustmentCard: {
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
  adjustmentTitle: {
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
  statusApplied: {
    backgroundColor: "#DDEDE5",
    color: colors.deepEmerald,
  },
  statusRejected: {
    backgroundColor: "#F4DDDD",
    color: "#8F2F2F",
  },
  targetBox: {
    backgroundColor: "#F7F5EF",
    borderRadius: 9,
    marginTop: 12,
    padding: 11,
  },
  targetTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  targetCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  detail: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  effectBox: {
    backgroundColor: "#EEF5F1",
    borderRadius: 9,
    marginTop: 12,
    padding: 11,
  },
  effectTitle: {
    color: colors.deepEmerald,
    fontSize: 11,
    fontWeight: "800",
  },
  effectCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
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
