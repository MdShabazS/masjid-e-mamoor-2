import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../../../src/auth/AuthProvider";
import { FinancePageHeader } from "../../../src/components/FinanceUI";
import { Screen } from "../../../src/components/Screen";
import { loadCapabilities } from "../../../src/modules/capabilities";
import { financeWorkspaceModules } from "../../../src/modules/finance-presentation";
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
        <View
          accessible
          accessibilityLabel="Loading Finance workspace..."
          accessibilityRole="progressbar"
          style={styles.loadingState}
        >
          <ActivityIndicator color={colors.deepEmerald} />
          <Text style={styles.stateCopy}>
            Loading Finance workspace...
          </Text>
        </View>
      </Screen>
    );
  }

  if (capabilities.isError) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={styles.centerState}
      >
        <View
          accessible
          accessibilityRole="alert"
          style={styles.statePanel}
        >
          <Text style={styles.stateTitle}>
            Finance workspace could not load
          </Text>

          <Text style={styles.stateCopy}>
            Check your connection and try again.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => void capabilities.refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryButtonText}>
              Retry
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const access = capabilities.data;
  const modules = access
    ? financeWorkspaceModules(access)
    : [];

  if (!access || modules.length === 0) {
    return (
      <Screen
        edges={["left", "right", "bottom"]}
        contentContainerStyle={styles.centerState}
      >
        <View style={styles.statePanel}>
          <Text style={styles.eyebrow}>
            FINANCE
          </Text>

          <Text style={styles.stateTitle}>
            Finance unavailable
          </Text>

          <Text style={styles.stateCopy}>
            Finance access is not available for your account.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      edges={["left", "right", "bottom"]}
      scroll
      contentContainerStyle={styles.content}
    >
      <FinancePageHeader
        title="Finance workspace"
        description="Review authorized financial records, operational workflows, reconciliation, and monthly reports."
      />

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>
          AUTHORIZED WORKSPACE
        </Text>

        <Text style={styles.sectionTitle}>
          Financial operations
        </Text>

        <Text style={styles.sectionCopy}>
          Only the Finance areas available through your current
          capabilities are shown here.
        </Text>
      </View>

      <View style={styles.grid}>
        {modules.map((module) => (
          <Pressable
            key={module.key}
            accessibilityRole="button"
            onPress={() => router.push(module.href)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardAccent} />

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>
                {module.title}
              </Text>

              <Text style={styles.cardCopy}>
                {module.description}
              </Text>

              <Text style={styles.cardAction}>
                Open {module.title.toLowerCase()} →
              </Text>
            </View>
          </Pressable>
        ))}
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
  statePanel: {
    alignItems: "center",
    maxWidth: 420,
    width: "100%",
  },
  loadingState: {
    alignItems: "center",
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  stateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  stateCopy: {
    color: colors.secondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
  section: {
    marginTop: 24,
  },
  sectionEyebrow: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 5,
  },
  sectionCopy: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  grid: {
    gap: 12,
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardAccent: {
    backgroundColor: colors.deepEmerald,
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  cardCopy: {
    color: colors.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  cardAction: {
    color: colors.deepEmerald,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 13,
  },
});
