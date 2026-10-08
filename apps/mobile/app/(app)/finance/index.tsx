import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../../../src/auth/AuthProvider";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import { colors } from "../../../src/theme/colors";

export default function FinanceHomeScreen() {
  const { account } = useAuth();

  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  if (!account) return null;

  if (capabilities.isLoading) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={styles.centerState}
      >
        <ActivityIndicator color={colors.deepEmerald} />
        <Text style={styles.stateCopy}>
          Loading Finance access...
        </Text>
      </Screen>
    );
  }

  const access = capabilities.data;

  if (
    capabilities.isError ||
    !access ||
    (!access.canReadFinanceAccounts &&
      !access.canReadFinanceMonthlyReports &&
      !access.canReadFinanceTransactions &&
      !access.canCreateFinanceTransfers &&
      !access.canApproveFinanceTransfers &&
      !access.canCreateFinanceExpenses &&
      !access.canApproveFinanceExpenses)
  ) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={styles.centerState}
      >
        <Text style={styles.eyebrow}>FINANCE</Text>
        <Text style={styles.title}>Finance</Text>
        <Text style={styles.stateCopy}>
          Finance access is not available for your account.
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
      <Text style={styles.eyebrow}>FINANCE</Text>

      <Text style={styles.title}>
        Finance workspace
      </Text>

      <Text style={styles.intro}>
        Review authorized Finance records and monthly
        financial report packs.
      </Text>

      <View style={styles.grid}>
        {access.canReadFinanceAccounts ? (
          <Pressable
            onPress={() =>
              router.push("/finance/accounts")
            }
            style={styles.card}
          >
            <Text style={styles.cardTitle}>
              Finance accounts
            </Text>
            <Text style={styles.cardCopy}>
              Review ledger-backed account balances and
              account lifecycle information.
            </Text>
            <Text style={styles.cardAction}>
              Open accounts →
            </Text>
          </Pressable>
        ) : null}

        {access.canReadFinanceTransactions ? (
          <Pressable
            onPress={() =>
              router.push("/finance/transactions")
            }
            style={styles.card}
          >
            <Text style={styles.cardTitle}>
              Finance transactions
            </Text>

            <Text style={styles.cardCopy}>
              Review the read-only authoritative
              Finance ledger across all accounts.
            </Text>

            <Text style={styles.cardAction}>
              Open transactions →
            </Text>
          </Pressable>
        ) : null}

        {access.canReadFinanceTransactions ||
        access.canCreateFinanceTransfers ||
        access.canApproveFinanceTransfers ? (
          <Pressable
            onPress={() =>
              router.push("/finance/transfers")
            }
            style={styles.card}
          >
            <Text style={styles.cardTitle}>
              Internal transfers
            </Text>

            <Text style={styles.cardCopy}>
              Move funds between Masjid Finance
              accounts using maker/checker approval.
            </Text>

            <Text style={styles.cardAction}>
              Open transfers →
            </Text>
          </Pressable>
        ) : null}

        {access.canReadFinanceTransactions ||
        access.canCreateFinanceExpenses ||
        access.canApproveFinanceExpenses ? (
          <Pressable
            onPress={() =>
              router.push("/finance/expenses")
            }
            style={styles.card}
          >
            <Text style={styles.cardTitle}>
              Finance expenses
            </Text>

            <Text style={styles.cardCopy}>
              Submit expenses and review their
              approval and posting lifecycle.
            </Text>

            <Text style={styles.cardAction}>
              Open expenses →
            </Text>
          </Pressable>
        ) : null}

        {access.canReadFinanceMonthlyReports ? (
          <Pressable
            onPress={() =>
              router.push("/finance/reports")
            }
            style={styles.card}
          >
            <Text style={styles.cardTitle}>
              Monthly reports
            </Text>
            <Text style={styles.cardCopy}>
              Review immutable monthly Finance summaries
              and available PDF report packs.
            </Text>
            <Text style={styles.cardAction}>
              Open reports →
            </Text>
          </Pressable>
        ) : null}
      </View>
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
  grid: {
    gap: 12,
    marginTop: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  cardCopy: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },
  cardAction: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
  },
  stateCopy: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
});
