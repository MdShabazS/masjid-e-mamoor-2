import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors } from "../../src/theme/colors";

export default function AppLayout() {
  const { loading, session, account } = useAuth();

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!account) return null;
  if (account.mustChangePassword) return <Redirect href="/(auth)/change-password" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.deepEmerald,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.sand },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="community" options={{ title: "Community" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
