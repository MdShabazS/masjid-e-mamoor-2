import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../src/auth/AuthProvider";
import {
  accountDirectoryQueryKey,
  accountStatusLabel,
  canAccessAccountAdministration,
  listManagedAccounts,
} from "../../../src/modules/accounts";
import { colors, roleLabels } from "../../../src/theme/colors";

export default function AccountsScreen() {
  const { account, session } = useAuth();
  const authorized = Boolean(
    account && canAccessAccountAdministration(account.role),
  );
  const accounts = useQuery({
    queryKey: accountDirectoryQueryKey(account?.id),
    queryFn: () => listManagedAccounts(session!),
    enabled: authorized && Boolean(session),
  });

  if (!account || !session) return null;
  if (!authorized) return <AccessState />;

  const items = accounts.data ?? [];
  const summary = {
    total: items.length,
    active: items.filter((item) => item.status === "active").length,
    deactivated: items.filter((item) => item.status === "deactivated").length,
    pending: items.filter((item) => item.mustChangePassword).length,
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={accounts.isRefetching}
            onRefresh={() => void accounts.refetch()}
            tintColor={colors.deepEmerald}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ADMINISTRATION</Text>
            <Text style={styles.title}>Accounts</Text>
            <Text style={styles.intro}>
              Manage authorized accounts and application access.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/accounts/create")}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>

        {accounts.isLoading ? <LoadingPanel /> : null}
        {accounts.isError ? (
          <ErrorPanel onRetry={() => void accounts.refetch()} />
        ) : null}

        {!accounts.isLoading && !accounts.isError ? (
          <>
            <View style={styles.summaryGrid}>
              <Summary label="Total" value={summary.total} />
              <Summary label="Active" value={summary.active} />
              <Summary label="Deactivated" value={summary.deactivated} />
              <Summary label="Password pending" value={summary.pending} />
            </View>

            <Text style={styles.sectionTitle}>Account directory</Text>
            {items.length === 0 ? (
              <EmptyPanel />
            ) : (
              items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: "/accounts/[id]",
                      params: { id: item.id },
                    })
                  }
                  style={styles.accountCard}
                >
                  <View style={styles.accountCopy}>
                    <Text style={styles.accountName}>
                      {item.username ?? "Username not set"}
                    </Text>
                    {item.displayName ? (
                      <Text style={styles.accountMeta}>{item.displayName}</Text>
                    ) : null}
                    <Text style={styles.accountMeta}>
                      {roleLabels[item.role]}
                    </Text>
                    <Text
                      style={[
                        styles.passwordState,
                        item.mustChangePassword && styles.passwordPending,
                      ]}
                    >
                      {item.mustChangePassword
                        ? "Password setup pending"
                        : "Password ready"}
                    </Text>
                  </View>
                  <View style={styles.cardAside}>
                    <Text
                      style={[
                        styles.statusBadge,
                        item.status === "deactivated" &&
                          styles.statusDeactivated,
                      ]}
                    >
                      {accountStatusLabel(item.status)}
                    </Text>
                    <Text style={styles.arrow}>›</Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function LoadingPanel() {
  return (
    <View style={styles.statePanel}>
      <ActivityIndicator color={colors.deepEmerald} />
      <Text style={styles.stateCopy}>Loading accounts...</Text>
    </View>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.statePanel}>
      <Text style={styles.stateTitle}>Accounts could not load</Text>
      <Text style={styles.stateCopy}>Check your connection and try again.</Text>
      <Pressable onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function EmptyPanel() {
  return (
    <View style={styles.statePanel}>
      <Text style={styles.stateTitle}>No accounts available</Text>
      <Text style={styles.stateCopy}>
        Accounts within your authorized scope will appear here.
      </Text>
    </View>
  );
}

function AccessState() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ADMINISTRATION</Text>
        <Text style={styles.title}>Accounts</Text>
        <Text style={styles.stateCopy}>
          Account Administration is not available for your account.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 20, paddingBottom: 44 },
  headerRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerCopy: { flex: 1, paddingRight: 16 },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  createButton: {
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButtonText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
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
    padding: 15,
  },
  summaryValue: { color: colors.deepEmerald, fontSize: 24, fontWeight: "700" },
  summaryLabel: { color: colors.secondary, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "700", marginBottom: 10, marginTop: 28 },
  accountCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    padding: 16,
  },
  accountCopy: { flex: 1, paddingRight: 12 },
  accountName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  accountMeta: { color: colors.secondary, fontSize: 13, marginTop: 4 },
  passwordState: { color: colors.success, fontSize: 12, fontWeight: "600", marginTop: 7 },
  passwordPending: { color: "#8B641D" },
  cardAside: { alignItems: "flex-end", gap: 10 },
  statusBadge: {
    backgroundColor: "#E1F0E7",
    borderRadius: 999,
    color: colors.success,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusDeactivated: { backgroundColor: "#F7E4E2", color: colors.danger },
  arrow: { color: colors.gold, fontSize: 28 },
  statePanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginTop: 22,
    padding: 24,
  },
  stateTitle: { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateCopy: { color: colors.secondary, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retryButton: { marginTop: 14, padding: 8 },
  retryText: { color: colors.deepEmerald, fontWeight: "700" },
});
