import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { isValidIsoDate } from "../../../../src/lib/date-input";
import { loadCapabilities } from "../../../../src/modules/capabilities";
import {
  completeFinanceReconciliation,
  type FinanceReconciliation,
  type FinanceReconciliationEvidenceType,
  type FinanceReconciliationItem,
  type FinanceReconciliationType,
  financeReconciliationDiscrepancyStatusLabel,
  financeReconciliationEvidenceTypeLabel,
  financeReconciliationItemsQueryKey,
  financeReconciliationsQueryKey,
  financeReconciliationStatusLabel,
  financeReconciliationTypeLabel,
  formatFinanceMoney,
  listFinanceReconciliationItems,
  listFinanceReconciliations,
  recordFinanceReconciliationItem,
  startFinanceReconciliation,
} from "../../../../src/modules/finance";
import { colors } from "../../../../src/theme/colors";

const reconciliationTypes: FinanceReconciliationType[] = [
  "monthly",
  "on_demand",
];

const evidenceTypes: FinanceReconciliationEvidenceType[] = [
  "bank_statement",
  "upi_statement",
  "cash_count",
  "receipt",
  "other",
];

function normalizeMonth(value: string) {
  const trimmed = value.trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    return null;
  }

  return `${trimmed}-01`;
}

function parseSignedRupeesToPaise(value: string) {
  const normalized = value.trim().replace(/,/g, "");

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative
    ? normalized.slice(1)
    : normalized;

  const [wholePart, fractionPart = ""] =
    unsigned.split(".");

  const whole = Number(wholePart);
  const fraction = Number(
    fractionPart.padEnd(2, "0"),
  );

  if (
    !Number.isSafeInteger(whole) ||
    !Number.isSafeInteger(fraction)
  ) {
    return null;
  }

  const amount = whole * 100 + fraction;
  const signed = negative ? -amount : amount;

  return Number.isSafeInteger(signed)
    ? signed
    : null;
}

function formatEditableBalance(
  amountPaise: number | null,
) {
  if (amountPaise === null) return "";

  const sign = amountPaise < 0 ? "-" : "";
  const absolute = Math.abs(amountPaise);
  const rupees = Math.floor(absolute / 100);
  const paise = absolute % 100;

  return `${sign}${rupees}.${String(paise).padStart(2, "0")}`;
}

function defaultEvidenceType(
  item: FinanceReconciliationItem,
): FinanceReconciliationEvidenceType {
  if (item.accountTypeSnapshot === "bank") {
    return "bank_statement";
  }

  if (item.accountTypeSnapshot === "upi") {
    return "upi_statement";
  }

  if (item.accountTypeSnapshot === "cash") {
    return "cash_count";
  }

  return "other";
}

export default function FinanceReconciliationScreen() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  const [reconciliationType, setReconciliationType] =
    useState<FinanceReconciliationType>("monthly");
  const [periodMonth, setPeriodMonth] = useState("");
  const [asOfBusinessDate, setAsOfBusinessDate] =
    useState("");
  const [startNotes, setStartNotes] = useState("");

  const [selectedReconciliationId, setSelectedReconciliationId] =
    useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] =
    useState<string | null>(null);
  const [externalBalance, setExternalBalance] =
    useState("");
  const [evidenceType, setEvidenceType] =
    useState<FinanceReconciliationEvidenceType>(
      "bank_statement",
    );
  const [evidenceReference, setEvidenceReference] =
    useState("");
  const [investigationNote, setInvestigationNote] =
    useState("");

  const [completionNotes, setCompletionNotes] =
    useState("");

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  const canRead =
    capabilities.data?.canReadFinanceReconciliation ===
    true;

  const canManage =
    capabilities.data?.canManageFinanceReconciliation ===
    true;

  const reconciliationsKey =
    financeReconciliationsQueryKey(account?.id);

  const reconciliations = useQuery({
    queryKey: reconciliationsKey,
    queryFn: listFinanceReconciliations,
    enabled: Boolean(account) && canRead,
  });

  const selectedReconciliation =
    reconciliations.data?.find(
      (item) => item.id === selectedReconciliationId,
    ) ?? null;

  const itemsKey = selectedReconciliationId
    ? financeReconciliationItemsQueryKey(
        selectedReconciliationId,
        account?.id,
      )
    : [
        "finance",
        "reconciliations",
        "none",
        "items",
        account?.id ?? "anonymous",
      ];

  const items = useQuery({
    queryKey: itemsKey,
    queryFn: () =>
      listFinanceReconciliationItems(
        selectedReconciliationId!,
      ),
    enabled:
      Boolean(account) &&
      canRead &&
      Boolean(selectedReconciliationId),
  });

  const selectedItem =
    items.data?.find(
      (item) => item.id === selectedItemId,
    ) ?? null;

  const refreshHistory = () =>
    queryClient.invalidateQueries({
      queryKey: reconciliationsKey,
    });

  const refreshItems = () => {
    if (!selectedReconciliationId) return;

    queryClient.invalidateQueries({
      queryKey: financeReconciliationItemsQueryKey(
        selectedReconciliationId,
        account?.id,
      ),
    });
  };

  const start = useMutation({
    mutationFn: async () => {
      if (reconciliationType === "monthly") {
        const normalizedMonth =
          normalizeMonth(periodMonth);

        if (!normalizedMonth) {
          throw new Error(
            "finance_reconciliation_month_invalid",
          );
        }

        return startFinanceReconciliation({
          reconciliationType,
          periodMonth: normalizedMonth,
          asOfBusinessDate: null,
          notes: startNotes,
        });
      }

      const asOf = asOfBusinessDate.trim();

      if (!isValidIsoDate(asOf)) {
        throw new Error(
          "finance_reconciliation_date_invalid",
        );
      }

      return startFinanceReconciliation({
        reconciliationType,
        periodMonth: null,
        asOfBusinessDate: asOf,
        notes: startNotes,
      });
    },
    onSuccess: (result) => {
      setSelectedReconciliationId(result.id);
      setSelectedItemId(null);
      setPeriodMonth("");
      setAsOfBusinessDate("");
      setStartNotes("");
      refreshHistory();

      Alert.alert(
        "Reconciliation started",
        "The authoritative account balances were snapshotted for reconciliation.",
      );
    },
    onError: (error) => {
      const code =
        error instanceof Error ? error.message : "";

      const message =
        code === "finance_reconciliation_month_invalid"
          ? "Enter the month as YYYY-MM."
          : code ===
              "finance_reconciliation_date_invalid"
            ? "Enter a valid as-of date as YYYY-MM-DD."
            : "The reconciliation could not be started. Check the dates, permissions, and whether a monthly reconciliation already exists.";

      Alert.alert(
        "Could not start reconciliation",
        message,
      );
    },
  });

  const recordItem = useMutation({
    mutationFn: async () => {
      if (!selectedItem) {
        throw new Error(
          "finance_reconciliation_item_required",
        );
      }

      const externalBalancePaise =
        parseSignedRupeesToPaise(externalBalance);

      if (externalBalancePaise === null) {
        throw new Error(
          "finance_reconciliation_balance_invalid",
        );
      }

      return recordFinanceReconciliationItem({
        reconciliationId:
          selectedItem.reconciliationId,
        financeAccountId:
          selectedItem.financeAccountId,
        externalBalancePaise,
        evidenceType,
        evidenceReference,
        investigationNote,
      });
    },
    onSuccess: () => {
      refreshItems();
      refreshHistory();

      Alert.alert(
        "Account reconciled",
        "The external balance and evidence details were recorded.",
      );
    },
    onError: (error) => {
      const code =
        error instanceof Error ? error.message : "";

      Alert.alert(
        "Could not record reconciliation",
        code ===
          "finance_reconciliation_balance_invalid"
          ? "Enter a valid external balance. Negative balances are supported."
          : "Check the evidence details and your reconciliation permission, then try again.",
      );
    },
  });

  const complete = useMutation({
    mutationFn: () => {
      if (!selectedReconciliationId) {
        throw new Error(
          "finance_reconciliation_id_required",
        );
      }

      return completeFinanceReconciliation({
        reconciliationId:
          selectedReconciliationId,
        notes: completionNotes,
      });
    },
    onSuccess: () => {
      setCompletionNotes("");
      refreshHistory();
      refreshItems();

      Alert.alert(
        "Reconciliation completed",
        "The reconciliation was closed without changing the authoritative Finance ledger.",
      );
    },
    onError: () => {
      Alert.alert(
        "Could not complete reconciliation",
        "Every account must have external evidence recorded, and open discrepancies must be investigated before completion.",
      );
    },
  });

  const selectItem = (
    item: FinanceReconciliationItem,
  ) => {
    setSelectedItemId(item.id);
    setExternalBalance(
      formatEditableBalance(
        item.externalBalancePaise,
      ),
    );
    setEvidenceType(
      item.evidenceType ??
        defaultEvidenceType(item),
    );
    setEvidenceReference(
      item.evidenceReference ?? "",
    );
    setInvestigationNote(
      item.investigationNote ?? "",
    );
  };

  if (!account) return null;

  if (capabilities.isLoading) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={styles.centerState}
      >
        <ActivityIndicator
          color={colors.deepEmerald}
        />
        <Text style={styles.stateCopy}>
          Loading reconciliation access...
        </Text>
      </Screen>
    );
  }

  if (
    capabilities.isError ||
    !capabilities.data ||
    !canRead
  ) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={styles.centerState}
      >
        <Text style={styles.eyebrow}>
          FINANCE
        </Text>
        <Text style={styles.title}>
          Reconciliation
        </Text>
        <Text style={styles.stateCopy}>
          Reconciliation access is not available
          for your account.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      edges={["left", "right", "bottom"]}
      scroll
      contentContainerStyle={styles.content}
    >
      <Text style={styles.eyebrow}>
        FINANCE
      </Text>

      <Text style={styles.title}>
        Reconciliation
      </Text>

      <Text style={styles.intro}>
        Compare authoritative Finance balances
        with bank statements, UPI statements,
        cash counts, receipts, and other external
        evidence. Discrepancies are recorded and
        investigated; reconciliation never silently
        repairs the ledger.
      </Text>

      {!canManage ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            Read-only oversight
          </Text>
          <Text style={styles.noticeCopy}>
            You can review reconciliation history,
            evidence references, and discrepancies.
            Starting, recording, and completing
            reconciliations is restricted to
            authorized Finance managers.
          </Text>
        </View>
      ) : null}

      {canManage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Start reconciliation
          </Text>

          <Text style={styles.label}>
            Reconciliation type
          </Text>

          <View style={styles.choiceRow}>
            {reconciliationTypes.map((type) => (
              <Pressable
                key={type}
                onPress={() =>
                  setReconciliationType(type)
                }
                style={[
                  styles.choice,
                  reconciliationType === type &&
                    styles.choiceSelected,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    reconciliationType === type &&
                      styles.choiceTextSelected,
                  ]}
                >
                  {financeReconciliationTypeLabel(
                    type,
                  )}
                </Text>
              </Pressable>
            ))}
          </View>

          {reconciliationType === "monthly" ? (
            <Field
              label="Month"
              value={periodMonth}
              onChangeText={setPeriodMonth}
              placeholder="YYYY-MM"
            />
          ) : (
            <Field
              label="As-of business date"
              value={asOfBusinessDate}
              onChangeText={setAsOfBusinessDate}
              placeholder="YYYY-MM-DD"
            />
          )}

          <Field
            label="Start notes"
            value={startNotes}
            onChangeText={setStartNotes}
            placeholder="Optional notes"
            multiline
          />

          <PrimaryButton
            label={
              start.isPending
                ? "Starting..."
                : "Start reconciliation"
            }
            disabled={start.isPending}
            onPress={() => start.mutate()}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Reconciliation history
          </Text>

          <Pressable
            onPress={refreshHistory}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonText}>
              Refresh
            </Text>
          </Pressable>
        </View>

        {reconciliations.isLoading ? (
          <ActivityIndicator
            color={colors.deepEmerald}
          />
        ) : reconciliations.isError ? (
          <Text style={styles.errorText}>
            Reconciliation history could not load.
          </Text>
        ) : reconciliations.data?.length ? (
          <View style={styles.cardList}>
            {reconciliations.data.map(
              (reconciliation) => (
                <ReconciliationCard
                  key={reconciliation.id}
                  reconciliation={reconciliation}
                  selected={
                    reconciliation.id ===
                    selectedReconciliationId
                  }
                  onPress={() => {
                    setSelectedReconciliationId(
                      reconciliation.id,
                    );
                    setSelectedItemId(null);
                    setCompletionNotes("");
                  }}
                />
              ),
            )}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No reconciliation runs yet.
          </Text>
        )}
      </View>

      {selectedReconciliation ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Selected reconciliation
          </Text>

          <DetailRow
            label="Type"
            value={financeReconciliationTypeLabel(
              selectedReconciliation.reconciliationType,
            )}
          />
          <DetailRow
            label="Status"
            value={financeReconciliationStatusLabel(
              selectedReconciliation.status,
            )}
          />
          <DetailRow
            label="As-of date"
            value={
              selectedReconciliation.asOfBusinessDate
            }
          />
          <DetailRow
            label="Month"
            value={
              selectedReconciliation.periodMonth ??
              "On-demand"
            }
          />

          {selectedReconciliation.startNotes ? (
            <DetailRow
              label="Start notes"
              value={
                selectedReconciliation.startNotes
              }
            />
          ) : null}

          <Text style={styles.subheading}>
            Accounts
          </Text>

          {items.isLoading ? (
            <ActivityIndicator
              color={colors.deepEmerald}
            />
          ) : items.isError ? (
            <Text style={styles.errorText}>
              Reconciliation accounts could not load.
            </Text>
          ) : items.data?.length ? (
            <View style={styles.cardList}>
              {items.data.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => selectItem(item)}
                  style={[
                    styles.itemCard,
                    selectedItemId === item.id &&
                      styles.selectedCard,
                  ]}
                >
                  <View style={styles.itemTopRow}>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>
                        {item.accountNameSnapshot}
                      </Text>
                      <Text style={styles.meta}>
                        {item.accountTypeSnapshot.toUpperCase()} ·{" "}
                        {item.currency}
                      </Text>
                    </View>

                    <Text style={styles.statusText}>
                      {financeReconciliationDiscrepancyStatusLabel(
                        item.discrepancyStatus,
                      )}
                    </Text>
                  </View>

                  <DetailRow
                    label="System balance"
                    value={formatFinanceMoney(
                      item.systemBalancePaise,
                    )}
                  />

                  <DetailRow
                    label="External balance"
                    value={
                      item.externalBalancePaise === null
                        ? "Not recorded"
                        : formatFinanceMoney(
                            item.externalBalancePaise,
                          )
                    }
                  />

                  <DetailRow
                    label="Difference"
                    value={
                      item.differencePaise === null
                        ? "Pending"
                        : formatFinanceMoney(
                            item.differencePaise,
                          )
                    }
                  />

                  {item.evidenceType ? (
                    <DetailRow
                      label="Evidence"
                      value={financeReconciliationEvidenceTypeLabel(
                        item.evidenceType,
                      )}
                    />
                  ) : null}

                  {item.evidenceReference ? (
                    <DetailRow
                      label="Reference"
                      value={item.evidenceReference}
                    />
                  ) : null}

                  {item.investigationNote ? (
                    <DetailRow
                      label="Investigation"
                      value={item.investigationNote}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No reconciliation accounts found.
            </Text>
          )}

          {canManage &&
          selectedReconciliation.status ===
            "in_progress" &&
          selectedItem ? (
            <View style={styles.editor}>
              <Text style={styles.subheading}>
                Record account evidence
              </Text>

              <Text style={styles.editorAccount}>
                {selectedItem.accountNameSnapshot}
              </Text>

              <Field
                label="External balance (₹)"
                value={externalBalance}
                onChangeText={setExternalBalance}
                placeholder="0.00"
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>
                Evidence type
              </Text>

              <View style={styles.choiceWrap}>
                {evidenceTypes.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() =>
                      setEvidenceType(type)
                    }
                    style={[
                      styles.choice,
                      evidenceType === type &&
                        styles.choiceSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        evidenceType === type &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      {financeReconciliationEvidenceTypeLabel(
                        type,
                      )}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Field
                label="Evidence reference"
                value={evidenceReference}
                onChangeText={setEvidenceReference}
                placeholder="Statement, count sheet, receipt, reference..."
              />

              <Field
                label="Investigation note"
                value={investigationNote}
                onChangeText={setInvestigationNote}
                placeholder="Required before completing an unresolved discrepancy"
                multiline
              />

              <PrimaryButton
                label={
                  recordItem.isPending
                    ? "Saving..."
                    : "Record evidence"
                }
                disabled={recordItem.isPending}
                onPress={() =>
                  recordItem.mutate()
                }
              />
            </View>
          ) : null}

          {canManage &&
          selectedReconciliation.status ===
            "in_progress" ? (
            <View style={styles.editor}>
              <Text style={styles.subheading}>
                Complete reconciliation
              </Text>

              <Text style={styles.help}>
                Completion is allowed only after
                every account has external evidence.
                Any non-zero discrepancy must have an
                investigation note. The server also
                checks that the system snapshot has
                not become stale.
              </Text>

              <Field
                label="Completion notes"
                value={completionNotes}
                onChangeText={setCompletionNotes}
                placeholder="Optional completion notes"
                multiline
              />

              <PrimaryButton
                label={
                  complete.isPending
                    ? "Completing..."
                    : "Complete reconciliation"
                }
                disabled={complete.isPending}
                onPress={() =>
                  Alert.alert(
                    "Complete reconciliation?",
                    "This closes the reconciliation record. It does not modify the Finance ledger.",
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                      {
                        text: "Complete",
                        onPress: () =>
                          complete.mutate(),
                      },
                    ],
                  )
                }
              />
            </View>
          ) : null}

          {selectedReconciliation.status ===
            "completed" ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>
                Completed
              </Text>
              <Text style={styles.noticeCopy}>
                This reconciliation is historical
                evidence and is immutable.
              </Text>

              {selectedReconciliation.completionNotes ? (
                <Text style={styles.noticeCopy}>
                  {
                    selectedReconciliation.completionNotes
                  }
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function ReconciliationCard({
  reconciliation,
  selected,
  onPress,
}: {
  reconciliation: FinanceReconciliation;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.itemCard,
        selected && styles.selectedCard,
      ]}
    >
      <View style={styles.itemTopRow}>
        <View style={styles.flex}>
          <Text style={styles.itemTitle}>
            {financeReconciliationTypeLabel(
              reconciliation.reconciliationType,
            )}{" "}
            reconciliation
          </Text>

          <Text style={styles.meta}>
            As of{" "}
            {reconciliation.asOfBusinessDate}
          </Text>
        </View>

        <Text style={styles.statusText}>
          {financeReconciliationStatusLabel(
            reconciliation.status,
          )}
        </Text>
      </View>

      {reconciliation.periodMonth ? (
        <Text style={styles.meta}>
          Period {reconciliation.periodMonth}
        </Text>
      ) : null}

      <Text style={styles.openText}>
        Review reconciliation →
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "numbers-and-punctuation";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.secondary}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        {label}
      </Text>
      <Text style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryButtonText}>
        {label}
      </Text>
    </Pressable>
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
    fontSize: 12,
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
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  subheading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 18,
  },
  field: {
    marginTop: 14,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.ivory,
    borderColor: colors.sand,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  choiceRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  choice: {
    borderColor: colors.sand,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceSelected: {
    backgroundColor: colors.deepEmerald,
    borderColor: colors.deepEmerald,
  },
  choiceText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  choiceTextSelected: {
    color: colors.ivory,
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
    color: colors.ivory,
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  inlineButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  inlineButtonText: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
  },
  cardList: {
    gap: 10,
    marginTop: 12,
  },
  itemCard: {
    backgroundColor: colors.ivory,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  selectedCard: {
    borderColor: colors.deepEmerald,
    borderWidth: 2,
  },
  itemTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  flex: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  meta: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  statusText: {
    color: colors.deepEmerald,
    fontSize: 12,
    fontWeight: "700",
  },
  openText: {
    color: colors.deepEmerald,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },
  detailRow: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    marginTop: 9,
  },
  detailLabel: {
    color: colors.secondary,
    flex: 1,
    fontSize: 12,
  },
  detailValue: {
    color: colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  editor: {
    borderTopColor: colors.sand,
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 2,
  },
  editorAccount: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 5,
  },
  help: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  noticeCopy: {
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  stateCopy: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  emptyText: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: 12,
  },
});
