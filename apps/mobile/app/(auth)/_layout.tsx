import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

export default function AuthLayout() {
  const { loading, session, account } = useAuth();
  const segments = useSegments();
  const onChangePassword = (segments as string[]).includes("change-password");

  if (loading) return null;
  if (!session) return <Stack screenOptions={{ headerShown: false }} />;
  if (account?.mustChangePassword && !onChangePassword) {
    return <Redirect href="/(auth)/change-password" />;
  }
  if (!onChangePassword) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
