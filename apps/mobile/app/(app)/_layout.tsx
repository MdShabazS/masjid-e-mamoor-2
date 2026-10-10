import { Redirect, Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/auth/AuthProvider";
import { loadCapabilities } from "../../src/modules/capabilities";
import { TabIcon } from "../../src/components/TabIcon";
import { NotificationRealtime } from "../../src/components/NotificationRealtime";
import { colors } from "../../src/theme/colors";

export default function AppLayout() {
  const { loading, session, account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!account) return null;
  if (account.mustChangePassword) return <Redirect href="/(auth)/change-password" />;

  return (
    <>
      <NotificationRealtime applicationUserId={account.id} />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.deepEmerald,
        tabBarInactiveTintColor: colors.secondary,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          paddingBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.sand,
          borderTopWidth: 1,
          elevation: 0,
          paddingBottom: 4,
          paddingTop: 6,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarAccessibilityLabel: "Home", tabBarIcon: ({ color }) => <TabIcon color={color} name="home" />, title: "Home" }} />
      <Tabs.Screen name="community" options={{ tabBarAccessibilityLabel: "Community", tabBarIcon: ({ color }) => <TabIcon color={color} name="community" />, title: "Community" }} />
      <Tabs.Screen name="accounts" options={{ href: null }} />
      <Tabs.Screen name="finance" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen
        name="work"
        options={{
          title: "Work",
          tabBarAccessibilityLabel: "Work",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="work" />,
          href: capabilities.data?.canReadCommitteeTasks ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="donations"
        options={{
          title: "Donations",
          tabBarAccessibilityLabel: "Donations",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="donations" />,
          href: capabilities.data?.canReadDonations ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ tabBarAccessibilityLabel: "Profile", tabBarIcon: ({ color }) => <TabIcon color={color} name="profile" />, title: "Profile" }} />
      </Tabs>
    </>
  );
}
