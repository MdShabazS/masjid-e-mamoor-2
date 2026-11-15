import { Redirect, Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../src/auth/AuthProvider";
import { loadCapabilities } from "../../src/modules/capabilities";
import { TabIcon } from "../../src/components/TabIcon";
import { NotificationRealtime } from "../../src/components/NotificationRealtime";
import { JummahAttendanceSync } from "../../src/components/JummahAttendanceSync";
import { primaryMobileTabs, type MobileModuleKey } from "../../src/modules/mobile-navigation";
import {
  formatUnreadBadge,
  getMyUnreadNotificationCount,
  notificationUnreadCountQueryKey,
} from "../../src/modules/notifications";
import { colors } from "../../src/theme/colors";
import { fontFamilies, touchTargets } from "../../src/theme/tokens";

const tabKeys: MobileModuleKey[] = [
  "home",
  "tasks",
  "meetings",
  "attendance",
  "community",
  "donations",
  "finance",
  "accounts",
  "notifications",
  "profile",
  "announcements",
  "more",
];

export default function AppLayout() {
  const { loading, session, account } = useAuth();
  const capabilities = useQuery({
    queryKey: ["capabilities", account?.id],
    queryFn: () => loadCapabilities(account!),
    enabled: Boolean(account),
  });
  const unread = useQuery({
    queryKey: notificationUnreadCountQueryKey(account?.id),
    queryFn: getMyUnreadNotificationCount,
    enabled: Boolean(account) && capabilities.data?.canReadNotifications === true,
  });

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!account) return null;
  if (account.mustChangePassword) return <Redirect href="/(auth)/change-password" />;

  const primaryTabs: MobileModuleKey[] = capabilities.data
    ? primaryMobileTabs(account.role, capabilities.data)
    : ["home"];
  const notificationBadge = formatUnreadBadge(unread.data ?? 0);
  const hiddenTabs = tabKeys.filter((key) => !primaryTabs.includes(key));
  const renderTab = (key: MobileModuleKey, visible: boolean) => {
    const href = visible ? undefined : null;

    switch (key) {
      case "home":
        return (
          <Tabs.Screen
            key={key}
            name="index"
            options={{
              href,
              tabBarAccessibilityLabel: "Home",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="home" />,
              title: "Home",
            }}
          />
        );
      case "tasks":
        return (
          <Tabs.Screen
            key={key}
            name="work"
            options={{
              href,
              tabBarAccessibilityLabel: "Tasks",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="work" />,
              title: "Tasks",
            }}
          />
        );
      case "meetings":
        return (
          <Tabs.Screen
            key={key}
            name="meetings"
            options={{
              href,
              tabBarAccessibilityLabel: "Meetings",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="meetings" />,
              title: "Meetings",
            }}
          />
        );
      case "attendance":
        return <Tabs.Screen key={key} name="attendance" options={{ href: null }} />;
      case "community":
        return (
          <Tabs.Screen
            key={key}
            name="community"
            options={{
              href,
              tabBarAccessibilityLabel: "Community",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="community" />,
              title: "Community",
            }}
          />
        );
      case "donations":
        return (
          <Tabs.Screen
            key={key}
            name="donations"
            options={{
              href,
              tabBarAccessibilityLabel: "Donations",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="donations" />,
              title: "Donations",
            }}
          />
        );
      case "finance":
        return (
          <Tabs.Screen
            key={key}
            name="finance"
            options={{
              href,
              tabBarAccessibilityLabel: "Finance",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="finance" />,
              title: "Finance",
            }}
          />
        );
      case "accounts":
        return (
          <Tabs.Screen
            key={key}
            name="accounts"
            options={{
              href,
              tabBarAccessibilityLabel: "Accounts",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="accounts" />,
              title: "Accounts",
            }}
          />
        );
      case "notifications":
        return (
          <Tabs.Screen
            key={key}
            name="notifications"
            options={{
              href,
              tabBarAccessibilityLabel: "Notifications",
              tabBarBadge: notificationBadge ?? undefined,
              tabBarBadgeStyle: {
                backgroundColor: colors.dangerRed,
                color: colors.white,
                fontFamily: fontFamilies.semibold,
                fontSize: 9,
              },
              tabBarIcon: ({ color }) => <TabIcon color={color} name="notifications" />,
              title: "Notifications",
            }}
          />
        );
      case "profile":
        return (
          <Tabs.Screen
            key={key}
            name="profile"
            options={{
              href,
              tabBarAccessibilityLabel: "Profile",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="profile" />,
              title: "Profile",
            }}
          />
        );
      case "more":
        return (
          <Tabs.Screen
            key={key}
            name="more"
            options={{
              href,
              tabBarAccessibilityLabel: "More",
              tabBarIcon: ({ color }) => <TabIcon color={color} name="more" />,
              title: "More",
            }}
          />
        );
      case "announcements":
        return <Tabs.Screen key={key} name="announcements" options={{ href }} />;
    }
  };

  return (
    <>
      <NotificationRealtime applicationUserId={account.id} />
      <JummahAttendanceSync />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primaryBlue,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontFamily: fontFamilies.semibold,
            lineHeight: 12,
            paddingBottom: 3,
          },
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            elevation: 0,
            minHeight: 66,
            paddingBottom: 7,
            paddingTop: 7,
            shadowOpacity: 0,
          },
          tabBarItemStyle: {
            minHeight: touchTargets.minimum,
          },
        }}
      >
        {primaryTabs.map((key) => renderTab(key, true))}
        {hiddenTabs.map((key) => renderTab(key, false))}
        <Tabs.Screen name="activity" options={{ href: null }} />
      </Tabs>
    </>
  );
}
