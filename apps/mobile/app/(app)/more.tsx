import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useAuth } from "../../src/auth/AuthProvider";
import { BrandedPageHeader, Divider, EmptyState, InformationCard, ListRow, LoadingState } from "../../src/components/InstitutionalUI";
import { Screen } from "../../src/components/Screen";
import { loadCapabilities } from "../../src/modules/capabilities";
import { moreMobileModules } from "../../src/modules/mobile-navigation";
import { spacing } from "../../src/theme/tokens";

export default function MoreScreen() {
  const { account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  if (!account || capabilities.isLoading) {
    return <Screen contentContainerStyle={styles.state}><LoadingState label="Loading your workspace" /></Screen>;
  }

  const modules = capabilities.data ? moreMobileModules(account.role, capabilities.data) : [];

  return (
    <Screen contentContainerStyle={styles.content} scroll>
      <BrandedPageHeader eyebrow="Authorized workspace" title="More" description="Additional tools available to your account." />
      <View style={styles.section}>
        {modules.length === 0 ? (
          <EmptyState title="No additional tools" description="Your primary navigation already contains every available module." />
        ) : (
          <InformationCard style={styles.listCard}>
            {modules.map((module, index) => (
              <View key={module.key}>
                {index > 0 ? <Divider /> : null}
                <ListRow title={module.label} subtitle={module.description} onPress={() => router.push(module.href)} />
              </View>
            ))}
          </InformationCard>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xl, paddingBottom: spacing.section },
  section: { marginTop: spacing.section },
  listCard: { paddingBottom: 0, paddingTop: 0 },
  state: { flex: 1, justifyContent: "center", padding: spacing.xl },
});
