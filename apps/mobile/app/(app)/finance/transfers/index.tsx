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
  type FinanceTransfer,
  decideFinanceTransfer,
  financeAccountsQueryKey,
  financeTransfersQueryKey,
  financeTransferStatusLabel,
  formatFinanceMoney,
  listFinanceAccounts,
  listFinanceTransfers,
  submitFinanceTransfer,
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

function transferErrorMessage(error: Error) {
  switch (error.message) {
    case "finance_transfer_account_required":
      return "Select both the source and destination Finance accounts.";

    case "finance_transfer_self_transfer":
      return "Source and destination accounts must be different.";

    case "finance_transfer_amount_invalid":
      return "Enter a valid transfer amount greater than ₹0.";

    case "finance_transfer_reason_invalid":
      return "Enter a transfer reason of 1000 characters or fewer.";

    case "finance_transfer_business_date_invalid":
      return "Enter a valid business date as YYYY-MM-DD.";

    case "finance_transfer_rejection_reason_required":
      return "A rejection reason is required.";

    case "finance_transfer_decision_reason_invalid":
      return "Decision reason must be 2000 characters or fewer.";

    case "finance_transfer_decide_failed":
      return "The transfer could not be approved or rejected. Check its current state, maker/checker rule, active accounts, and your permission.";

    default:
      return "The Finance transfer operation could not be completed.";
  }
}

export default function FinanceTransfersScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState({
    sourceFinanceAccountId: "",
    destinationFinanceAccountId: "",
    amount: "",
    reason: "",
    businessDate: localIsoDate(),
  });

  const [
    rejectingTransferId,
    setRejectingTransferId,
  ] = useState<string | null>(null);

  const [rejectionReason, setRejectionReason] =
    useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const access = capabilities.data;

  const canAccessTransfers =
    access?.canReadFinanceTransactions === true ||
    access?.canCreateFinanceTransfers === true ||
    access?.canApproveFinanceTransfers === true;

  const transfers = useQuery({
    queryKey: financeTransfersQueryKey(
      account?.id,
    ),
    queryFn: listFinanceTransfers,
    enabled: Boolean(
      account && canAccessTransfers,
    ),
  });

  const accounts = useQuery({
    queryKey: financeAccountsQueryKey(
      account?.id,
    ),
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

  const accountBalances = useMemo(
    () =>
      new Map(
        (accounts.data ?? []).map((item) => [
          item.id,
          item.balancePaise,
        ]),
      ),
    [accounts.data],
  );

  const sourceDraftAccount =
    activeAccounts.find(
      (item) =>
        item.id ===
        draft.sourceFinanceAccountId,
    );

  const parsedAmount =
    parseRupeesToPaise(draft.amount);

  const wouldCreateNegativeBalance =
    sourceDraftAccount !== undefined &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    parsedAmount >
      sourceDraftAccount.balancePaise;

  const draftIsValid =
    Boolean(draft.sourceFinanceAccountId) &&
    Boolean(
      draft.destinationFinanceAccountId,
    ) &&
    draft.sourceFinanceAccountId !==
      draft.destinationFinanceAccountId &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    draft.reason.trim().length > 0 &&
    draft.reason.trim().length <= 1000 &&
    isValidIsoDate(draft.businessDate);

  const submitTransfer = useMutation({
    mutationFn: () =>
      submitFinanceTransfer({
        sourceFinanceAccountId:
          draft.sourceFinanceAccountId,
        destinationFinanceAccountId:
          draft.destinationFinanceAccountId,
        amount: draft.amount,
        reason: draft.reason,
        businessDate: draft.businessDate,
      }),

    onSuccess: async () => {
      setDraft({
        sourceFinanceAccountId: "",
        destinationFinanceAccountId: "",
        amount: "",
        reason: "",
        businessDate: localIsoDate(),
      });

      await transfers.refetch();

      Alert.alert(
        "Transfer submitted",
        "The transfer is awaiting approval by another authorized Finance user.",
      );
    },

    onError: (error) => {
      Alert.alert(
        "Transfer could not be submitted",
        transferErrorMessage(error),
      );
    },
  });

  const decideTransfer = useMutation({
    mutationFn: decideFinanceTransfer,

    onSuccess: async () => {
      setRejectingTransferId(null);
      setRejectionReason("");

      await transfers.refetch();

      await queryClient.invalidateQueries({
        queryKey: ["finance", "accounts"],
      });
    },

    onError: (error) => {
      Alert.alert(
        "Transfer decision failed",
        transferErrorMessage(error),
      );
    },
  });

  function confirmApprove(
    transfer: FinanceTransfer,
  ) {
    const sourceBalance =
      accountBalances.get(
        transfer.sourceFinanceAccountId,
      );

    const negativeWarning =
      sourceBalance !== undefined &&
      transfer.amountPaise > sourceBalance
        ? "\n\nWarning: approving this transfer will make the source account balance negative."
        : "";

    Alert.alert(
      "Approve transfer?",
      `Move ${formatFinanceMoney(
        transfer.amountPaise,
      )} from ${
        accountNames.get(
          transfer.sourceFinanceAccountId,
        ) ?? "the source account"
      } to ${
        accountNames.get(
          transfer.destinationFinanceAccountId,
        ) ?? "the destination account"
      }?${negativeWarning}`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Approve",
          onPress: () =>
            decideTransfer.mutate({
              financeTransferId:
                transfer.id,
              decision: "approve",
            }),
        },
      ],
    );
  }

  function confirmReject(
    transfer: FinanceTransfer,
  ) {
    const reason =
      rejectionReason.trim();

    if (!reason) {
      Alert.alert(
        "Rejection reason required",
        "Enter why this transfer is being rejected.",
      );
      return;
    }

    Alert.alert(
      "Reject transfer?",
      "No Finance ledger movement will be posted for this transfer.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Reject",
          style: "destructive",
          onPress: () =>
            decideTransfer.mutate({
              financeTransferId:
                transfer.id,
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
    !canAccessTransfers
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
          Transfers
        </Text>

        <Text style={styles.stateCopy}>
          Transfer access is not available for
          your account.
        </Text>
      </Screen>
    );
  }

  const refreshing =
    transfers.isRefetching ||
    accounts.isRefetching;

  const pendingCount =
    transfers.data?.filter(
      (item) => item.status === "submitted",
    ).length ?? 0;

  const approvedCount =
    transfers.data?.filter(
      (item) => item.status === "approved",
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
              void transfers.refetch();

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
          title="Internal transfers"
          description="Move funds between Finance accounts using the existing maker/checker workflow without changing overall Masjid funds."
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
              {approvedCount}
            </Text>
            <Text style={styles.summaryLabel}>
              Approved
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {transfers.data?.length ?? 0}
            </Text>
            <Text style={styles.summaryLabel}>
              Total
            </Text>
          </View>
        </View>

        {access.canCreateFinanceTransfers ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>
              Submit transfer
            </Text>

            <Text style={styles.help}>
              Submission does not move funds
              immediately. Another authorized
              Finance user must approve it.
            </Text>

            {accounts.isError ? (
              <Text style={styles.errorCopy}>
                Finance accounts could not be
                loaded.
              </Text>
            ) : null}

            {!accounts.isLoading &&
            !accounts.isError &&
            activeAccounts.length < 2 ? (
              <Text style={styles.errorCopy}>
                At least two active Finance
                accounts are required for an
                internal transfer.
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>
              Source account
            </Text>

            <View style={styles.accountChoices}>
              {activeAccounts.map(
                (financeAccount) => {
                  const selected =
                    draft.sourceFinanceAccountId ===
                    financeAccount.id;

                  return (
                    <Pressable
                      key={financeAccount.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          sourceFinanceAccountId:
                            financeAccount.id,
                          destinationFinanceAccountId:
                            current
                              .destinationFinanceAccountId ===
                            financeAccount.id
                              ? ""
                              : current
                                  .destinationFinanceAccountId,
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
              Destination account
            </Text>

            <View style={styles.accountChoices}>
              {activeAccounts
                .filter(
                  (financeAccount) =>
                    financeAccount.id !==
                    draft.sourceFinanceAccountId,
                )
                .map((financeAccount) => {
                  const selected =
                    draft.destinationFinanceAccountId ===
                    financeAccount.id;

                  return (
                    <Pressable
                      key={financeAccount.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          destinationFinanceAccountId:
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
                })}
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

            {wouldCreateNegativeBalance ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>
                  Negative balance warning
                </Text>

                <Text style={styles.warningCopy}>
                  This transfer exceeds the
                  current source account balance.
                  V1 permits a negative balance,
                  but the approver should verify
                  the transfer carefully.
                </Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>
              Reason
            </Text>

            <TextInput
              value={draft.reason}
              onChangeText={(reason) =>
                setDraft((current) => ({
                  ...current,
                  reason,
                }))
              }
              multiline
              maxLength={1000}
              placeholder="Why are these funds being moved?"
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
                  submitTransfer.isPending ||
                  activeAccounts.length < 2,
              }}
              disabled={
                !draftIsValid ||
                submitTransfer.isPending ||
                activeAccounts.length < 2
              }
              onPress={() =>
                submitTransfer.mutate()
              }
              style={[
                styles.primaryButton,
                (!draftIsValid ||
                  submitTransfer.isPending ||
                  activeAccounts.length < 2) &&
                  styles.disabled,
              ]}
            >
              <Text
                style={styles.primaryButtonText}
              >
                {submitTransfer.isPending
                  ? "Submitting..."
                  : "Submit transfer"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Transfer history
            </Text>

            <Text style={styles.help}>
              Newest submissions appear first.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => transfers.refetch()}
          >
            <Text style={styles.refreshAction}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {transfers.isLoading ? (
          <View
            accessible
            accessibilityLabel="Loading Finance transfers..."
            accessibilityRole="progressbar"
            style={styles.statePanel}
          >
            <ActivityIndicator
              color={colors.deepEmerald}
            />
            <Text style={styles.stateCopy}>
              Loading transfers...
            </Text>
          </View>
        ) : null}

        {transfers.isError ? (
          <View
            accessible
            accessibilityRole="alert"
            style={styles.statePanel}
          >
            <Text style={styles.errorCopy}>
              Finance transfers could not be
              loaded.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => transfers.refetch()}
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

        {!transfers.isLoading &&
        !transfers.isError &&
        (transfers.data?.length ?? 0) === 0 ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateCopy}>
              No Finance transfers have been
              recorded yet.
            </Text>
          </View>
        ) : null}

        {(transfers.data ?? []).map(
          (transfer) => {
            const submittedByCurrentUser =
              transfer
                .submittedByApplicationUserId ===
              account.id;

            const canDecide =
              access.canApproveFinanceTransfers &&
              transfer.status === "submitted" &&
              !submittedByCurrentUser;

            const rejecting =
              rejectingTransferId ===
              transfer.id;

            const sourceBalance =
              accountBalances.get(
                transfer.sourceFinanceAccountId,
              );

            const negativeBalanceWarning =
              transfer.status === "submitted" &&
              sourceBalance !== undefined &&
              transfer.amountPaise >
                sourceBalance;

            return (
              <View
                key={transfer.id}
                style={styles.transferCard}
              >
                <View
                  style={styles.cardTopRow}
                >
                  <View style={styles.cardTopCopy}>
                    <Text
                      style={styles.transferRoute}
                    >
                      {accountNames.get(
                        transfer.sourceFinanceAccountId,
                      ) ?? "Source account"}{" "}
                      →{" "}
                      {accountNames.get(
                        transfer.destinationFinanceAccountId,
                      ) ??
                        "Destination account"}
                    </Text>

                    <Text style={styles.meta}>
                      {transfer.businessDate}
                    </Text>
                  </View>

                  <Text
                    style={styles.transferAmount}
                  >
                    {formatFinanceMoney(
                      transfer.amountPaise,
                    )}
                  </Text>
                </View>

                <View style={styles.statusRow}>
                    <FinanceStatusChip
                      label={financeTransferStatusLabel(
                        transfer.status,
                      )}
                      status={transfer.status}
                    />
                  </View>

                <Text style={styles.detail}>
                  Reason: {transfer.reason}
                </Text>

                <Text style={styles.detail}>
                  {submittedByCurrentUser
                    ? "Submitted by you"
                    : "Submitted by another authorized user"}
                </Text>

                {negativeBalanceWarning ? (
                  <View style={styles.warningBox}>
                    <Text
                      style={styles.warningTitle}
                    >
                      Negative balance warning
                    </Text>

                    <Text
                      style={styles.warningCopy}
                    >
                      The transfer amount currently
                      exceeds the source account
                      balance. This is permitted by
                      V1 but should be reviewed
                      carefully before approval.
                    </Text>
                  </View>
                ) : null}

                {transfer.status ===
                  "rejected" &&
                transfer.rejectionReason ? (
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
                        transfer.rejectionReason
                      }
                    </Text>
                  </View>
                ) : null}

                {transfer.status ===
                  "submitted" &&
                submittedByCurrentUser ? (
                  <Text style={styles.notice}>
                    Maker/checker control: another
                    authorized Finance user must
                    decide this transfer.
                  </Text>
                ) : null}

                {transfer.status ===
                  "submitted" &&
                !submittedByCurrentUser &&
                !access.canApproveFinanceTransfers ? (
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
                        accessibilityRole="button"
                        accessibilityState={{
                          disabled: decideTransfer.isPending,
                        }}
                        disabled={
                          decideTransfer.isPending
                        }
                        onPress={() =>
                          confirmApprove(transfer)
                        }
                        style={[
                          styles.approveButton,
                          decideTransfer.isPending &&
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
                          disabled: decideTransfer.isPending,
                        }}
                        disabled={
                          decideTransfer.isPending
                        }
                        onPress={() => {
                          if (rejecting) {
                            setRejectingTransferId(
                              null,
                            );
                            setRejectionReason("");
                          } else {
                            setRejectingTransferId(
                              transfer.id,
                            );
                            setRejectionReason("");
                          }
                        }}
                        style={[
                          styles.rejectButton,
                          decideTransfer.isPending &&
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
                          placeholder="Why is this transfer being rejected?"
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
                              decideTransfer.isPending,
                          }}
                          disabled={
                            !rejectionReason.trim() ||
                            decideTransfer.isPending
                          }
                          onPress={() =>
                            confirmReject(transfer)
                          }
                          style={[
                            styles.confirmRejectButton,
                            (!rejectionReason.trim() ||
                              decideTransfer.isPending) &&
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
    marginTop: 8,
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
  warningBox: {
    backgroundColor: "#FFF7E3",
    borderColor: "#E4C56B",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  warningTitle: {
    color: "#755A0A",
    fontSize: 12,
    fontWeight: "800",
  },
  warningCopy: {
    color: "#755A0A",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
  transferCard: {
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
  transferRoute: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  transferAmount: {
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
  statusApproved: {
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
