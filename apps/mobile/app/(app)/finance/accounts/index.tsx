import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  FinanceAccount,
  FinanceAccountSnapshot,
} from "@masjid-e-mamoor/types";
import {
  financeAccountCreateSchema,
} from "@masjid-e-mamoor/validation";

import { useAuth } from "../../../../src/auth/AuthProvider";
import {
  FinancePageHeader,
  FinanceStatusChip,
} from "../../../../src/components/FinanceUI";
import { FormTextInput, Screen } from "../../../../src/components/Screen";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  changeFinanceAccountStatus,
  createFinanceAccount,
  financeAccountsQueryKey,
  financeAccountStatusLabel,
  financeAccountTypeLabel,
  formatFinanceMoney,
  listFinanceAccounts,
  renameFinanceAccount,
} from "../../../../src/modules/finance";
import { colors } from "../../../../src/theme/colors";

const accountTypes: FinanceAccount["accountType"][] = [
  "bank",
  "upi",
  "cash",
  "other",
];

export default function FinanceAccountsScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [accountType, setAccountType] =
    useState<FinanceAccount["accountType"]>("upi");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const authorized =
    capabilities.data?.canReadFinanceAccounts === true;

  const directoryKey = financeAccountsQueryKey(account?.id);

  const accounts = useQuery({
    queryKey: directoryKey,
    queryFn: listFinanceAccounts,
    enabled: Boolean(account) && authorized,
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: directoryKey,
    });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = financeAccountCreateSchema.safeParse({
        name,
        accountType,
        operationId: "mobile-preflight",
      });

      if (!parsed.success) {
        throw new Error("invalid_input");
      }

      return createFinanceAccount({
        name: parsed.data.name,
        accountType: parsed.data.accountType,
      });
    },
    onSuccess: async () => {
      setName("");
      setAccountType("upi");
      await refresh();
      Alert.alert(
        "Finance account created",
        "The account is now available for authorized Finance workflows.",
      );
    },
    onError: (error) => {
      Alert.alert(
        "Finance account could not be created",
        error.message === "invalid_input"
          ? "Enter a valid account name and type."
          : "Check your authorization and try again.",
      );
    },
  });

  const changeStatus = useMutation({
    mutationFn: (input: {
      financeAccountId: string;
      status: FinanceAccount["status"];
    }) => changeFinanceAccountStatus(input),
    onSuccess: async () => {
      await refresh();
      Alert.alert(
        "Finance account updated",
        "The account lifecycle status has been updated.",
      );
    },
    onError: () => {
      Alert.alert(
        "Finance account could not be updated",
        "The backend authorization and lifecycle rules prevented the change.",
      );
    },
  });

  const rename = useMutation({
    mutationFn: (input: {
      financeAccountId: string;
      name: string;
    }) => renameFinanceAccount(input),
    onSuccess: async () => {
      await refresh();

      Alert.alert(
        "Finance account name updated",
        "The audited account label correction has been saved.",
      );
    },
    onError: () => {
      Alert.alert(
        "Finance account name could not be updated",
        "Check the name and your Finance account management permission, then try again.",
      );
    },
  });

  if (!account) return null;

  if (capabilities.isLoading) {
    return <LoadingState copy="Loading Finance access..." />;
  }

  if (
    capabilities.isError ||
    !capabilities.data?.canReadFinanceAccounts
  ) {
    return <AccessState />;
  }

  const items = accounts.data ?? [];

  const summary = {
    total: items.length,
    active: items.filter(
      (item) => item.status === "active",
    ).length,
    inactive: items.filter(
      (item) => item.status === "inactive",
    ).length,
    closed: items.filter(
      (item) => item.status === "closed",
    ).length,
    balancePaise: items.reduce(
      (sum, item) => sum + item.balancePaise,
      0,
    ),
  };

  return (
    <Screen
      edges={["left", "right", "bottom"]}
      keyboardAware
      scroll
      contentContainerStyle={styles.content}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={accounts.isRefetching}
            onRefresh={() => void accounts.refetch()}
            tintColor={colors.deepEmerald}
          />
        ),
      }}
    >
      <FinancePageHeader
        title="Finance accounts"
        description="Ledger-backed balances and authorized Finance account lifecycle controls."
      />

      {accounts.isLoading ? (
        <LoadingPanel />
      ) : null}

      {accounts.isError ? (
        <ErrorPanel
          onRetry={() => void accounts.refetch()}
        />
      ) : null}

      {!accounts.isLoading && !accounts.isError ? (
        <>
          <View style={styles.summaryGrid}>
            <Summary
              label="Total balance"
              value={formatFinanceMoney(
                summary.balancePaise,
              )}
            />
            <Summary
              label="Accounts"
              value={String(summary.total)}
            />
            <Summary
              label="Active"
              value={String(summary.active)}
            />
            <Summary
              label="Inactive"
              value={String(summary.inactive)}
            />
            <Summary
              label="Closed"
              value={String(summary.closed)}
            />
          </View>

          {capabilities.data.canManageFinanceAccounts ? (
            <View style={styles.adminPanel}>
              <Text style={styles.sectionTitle}>
                Create Finance account
              </Text>

              <Text style={styles.help}>
                Create the actual Bank, UPI, Cash, or
                Other receiving account used by the
                organization.
              </Text>

              <Text style={styles.fieldLabel}>
                Account name
              </Text>

              <FormTextInput
                value={name}
                onChangeText={setName}
                placeholder="Example: Main UPI"
                placeholderTextColor="#93A099"
                maxLength={120}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Account type
              </Text>

              <View style={styles.optionGrid}>
                {accountTypes.map((type) => (
                  <Pressable accessibilityRole="button"
                    key={type}
                    onPress={() =>
                      setAccountType(type)
                    }
                    style={[
                      styles.option,
                      accountType === type &&
                        styles.optionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        accountType === type &&
                          styles.optionTextSelected,
                      ]}
                    >
                      {financeAccountTypeLabel(type)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable accessibilityRole="button"
                disabled={
                  create.isPending ||
                  name.trim().length === 0
                }
                onPress={() => create.mutate()}
                style={[
                  styles.primaryButton,
                  (create.isPending ||
                    name.trim().length === 0) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {create.isPending
                    ? "Creating..."
                    : "Create Finance account"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>
                Read-only Finance access
              </Text>
              <Text style={styles.help}>
                Your account can review Finance
                accounts and balances but cannot change
                their lifecycle.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            Finance account directory
          </Text>

          {items.length === 0 ? (
            <View style={styles.statePanel}>
              <Text style={styles.stateTitle}>
                No Finance accounts yet
              </Text>
              <Text style={styles.stateCopy}>
                An authorized Finance account manager
                must create the first account before
                verified donation money can be posted.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <FinanceAccountCard
                key={`${item.id}:${item.updatedAt}`}
                account={item}
                canManage={
                  capabilities.data
                    .canManageFinanceAccounts
                }
                pending={
                  changeStatus.isPending ||
                  rename.isPending
                }
                onRename={(name) =>
                  rename.mutate({
                    financeAccountId: item.id,
                    name,
                  })
                }
                onChangeStatus={(status) =>
                  confirmStatusChange(
                    item,
                    status,
                    () =>
                      changeStatus.mutate({
                        financeAccountId: item.id,
                        status,
                      }),
                  )
                }
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

function FinanceAccountCard({
  account,
  canManage,
  pending,
  onRename,
  onChangeStatus,
}: {
  account: FinanceAccountSnapshot;
  canManage: boolean;
  pending: boolean;
  onRename: (name: string) => void;
  onChangeStatus: (
    status: FinanceAccount["status"],
  ) => void;
}) {
  const [renameName, setRenameName] =
    useState(account.name);

  const normalizedRenameName =
    renameName.trim();

  const renameDisabled =
    pending ||
    normalizedRenameName.length === 0 ||
    normalizedRenameName === account.name;

  return (
    <View style={styles.accountCard}>
      <View style={styles.accountHeader}>
        <View style={styles.accountCopy}>
          <Text style={styles.accountName}>
            {account.name}
          </Text>

          <Text style={styles.accountMeta}>
            {financeAccountTypeLabel(
              account.accountType,
            )}{" "}
            · {account.currency}
          </Text>
        </View>

        <FinanceStatusChip
          label={financeAccountStatusLabel(account.status)}
          status={account.status}
        />
      </View>

      <View style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>
          Ledger balance
        </Text>
        <Text style={styles.balanceValue}>
          {formatFinanceMoney(
            account.balancePaise,
          )}
        </Text>
      </View>

      {canManage ? (
        <View style={styles.renamePanel}>
          <Text style={styles.fieldLabel}>
            Account name
          </Text>

          <FormTextInput
            value={renameName}
            onChangeText={setRenameName}
            maxLength={120}
            style={styles.input}
          />

          <Pressable accessibilityRole="button"
            disabled={renameDisabled}
            onPress={() => {
              setRenameName(
                normalizedRenameName,
              );
              onRename(normalizedRenameName);
            }}
            style={[
              styles.secondaryButton,
              styles.renameButton,
              renameDisabled && styles.disabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              Save account name
            </Text>
          </Pressable>

          <Text style={styles.renameHelp}>
            Name corrections are audited and do not
            change account identity, type, status,
            balance, or ledger history.
          </Text>
        </View>
      ) : null}

      {canManage && account.status !== "closed" ? (
        <View style={styles.buttonRow}>
          {account.status === "active" ? (
            <Pressable accessibilityRole="button"
              disabled={pending}
              onPress={() =>
                onChangeStatus("inactive")
              }
              style={[
                styles.secondaryButton,
                pending && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Mark inactive
              </Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button"
              disabled={pending}
              onPress={() =>
                onChangeStatus("active")
              }
              style={[
                styles.secondaryButton,
                pending && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Reactivate
              </Text>
            </Pressable>
          )}

          <Pressable accessibilityRole="button"
            disabled={pending}
            onPress={() =>
              onChangeStatus("closed")
            }
            style={[
              styles.dangerButton,
              pending && styles.disabled,
            ]}
          >
            <Text style={styles.dangerButtonText}>
              Close permanently
            </Text>
          </Pressable>
        </View>
      ) : null}

      {account.status === "closed" ? (
        <Text style={styles.closedCopy}>
          Permanently closed. Historical ledger records
          remain available.
        </Text>
      ) : null}
    </View>
  );
}

function confirmStatusChange(
  account: FinanceAccountSnapshot,
  status: FinanceAccount["status"],
  onConfirm: () => void,
) {
  if (status === "closed") {
    Alert.alert(
      "Close Finance account permanently?",
      `${account.name} cannot be reopened after closure. Historical ledger records will remain available.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close permanently",
          style: "destructive",
          onPress: onConfirm,
        },
      ],
    );
    return;
  }

  const activating = status === "active";

  Alert.alert(
    activating
      ? "Reactivate Finance account?"
      : "Mark Finance account inactive?",
    activating
      ? `${account.name} will become available for new Finance operations.`
      : `${account.name} will stop accepting new Finance operations until reactivated.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: activating
          ? "Reactivate"
          : "Mark inactive",
        onPress: onConfirm,
      },
    ],
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
      <ActivityIndicator
        color={colors.deepEmerald}
      />
      <Text style={styles.stateCopy}>
        Loading Finance accounts...
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
      <ActivityIndicator
        color={colors.deepEmerald}
      />
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
        Finance accounts could not load
      </Text>
      <Text style={styles.stateCopy}>
        Check your connection and try again.
      </Text>
      <Pressable accessibilityRole="button"
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
        Finance accounts
      </Text>
      <Text style={styles.stateCopy}>
        Finance account access is not available for your
        account.
      </Text>
    </Screen>
  );
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
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 26,
    marginBottom: 10,
  },
  help: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
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
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: "#D9D3C6",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  optionText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: "600",
  },
  optionTextSelected: {
    color: colors.surface,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
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
  accountCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  accountHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  accountCopy: {
    flex: 1,
    paddingRight: 12,
  },
  accountName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  accountMeta: {
    color: colors.secondary,
    fontSize: 13,
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
  balancePanel: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    marginTop: 15,
    paddingTop: 14,
  },
  balanceLabel: {
    color: colors.secondary,
    fontSize: 12,
  },
  balanceValue: {
    color: colors.deepEmerald,
    fontSize: 23,
    fontWeight: "700",
    marginTop: 4,
  },
  renamePanel: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 2,
  },
  renameButton: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  renameHelp: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  secondaryButton: {
    borderColor: colors.deepEmerald,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "#F7E4E2",
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  closedCopy: {
    color: colors.secondary,
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
