import { Redirect, Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/auth/AuthProvider";
import { loadCapabilities } from "../../src/modules/capabilities";
import { TabIcon } from "../../src/components/TabIcon";
import { NotificationRealtime } from "../../src/components/NotificationRealtime";
import { primaryMobileTabs, type MobileModuleKey } from "../../src/modules/mobile-navigation";
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

  const primaryTabs: MobileModuleKey[] = capabilities.data
    ? primaryMobileTabs(account.role, capabilities.data)
    : ["home"];
  const tabHref = (key: MobileModuleKey) =>
    primaryTabs.includes(key) ? undefined : null;

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
      <Tabs.Screen name="community" options={{ href: tabHref("community"), tabBarAccessibilityLabel: "Community", tabBarIcon: ({ color }) => <TabIcon color={color} name="community" />, title: "Community" }} />
      <Tabs.Screen name="accounts" options={{ href: tabHref("accounts"), tabBarAccessibilityLabel: "Accounts", tabBarIcon: ({ color }) => <TabIcon color={color} name="accounts" />, title: "Accounts" }} />
      <Tabs.Screen name="finance" options={{ href: tabHref("finance"), tabBarAccessibilityLabel: "Finance", tabBarIcon: ({ color }) => <TabIcon color={color} name="finance" />, title: "Finance" }} />
      <Tabs.Screen name="notifications" options={{ href: tabHref("notifications"), tabBarAccessibilityLabel: "Updates", tabBarIcon: ({ color }) => <TabIcon color={color} name="notifications" />, title: "Updates" }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="meetings" options={{ href: tabHref("meetings"), tabBarAccessibilityLabel: "Meetings", tabBarIcon: ({ color }) => <TabIcon color={color} name="meetings" />, title: "Meetings" }} />
      <Tabs.Screen
        name="work"
        options={{
          title: "Tasks",
          tabBarAccessibilityLabel: "Tasks",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="work" />,
          href: tabHref("tasks"),
        }}
      />
      <Tabs.Screen
        name="donations"
        options={{
          title: "Donations",
          tabBarAccessibilityLabel: "Donations",
          tabBarIcon: ({ color }) => <TabIcon color={color} name="donations" />,
          href: tabHref("donations"),
        }}
      />
      <Tabs.Screen name="profile" options={{ href: tabHref("profile"), tabBarAccessibilityLabel: "Profile", tabBarIcon: ({ color }) => <TabIcon color={color} name="profile" />, title: "Profile" }} />
      <Tabs.Screen name="more" options={{ href: tabHref("more"), tabBarAccessibilityLabel: "More", tabBarIcon: ({ color }) => <TabIcon color={color} name="more" />, title: "More" }} />
      </Tabs>
    </>
  );
}
