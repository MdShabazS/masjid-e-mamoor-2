import { Stack } from "expo-router";
import { colors } from "../../../src/theme/colors";

export default function AccountsLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.ivory },
        headerBackTitle: "Accounts",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.ivory },
        headerTintColor: colors.deepEmerald,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: "Create account" }} />
      <Stack.Screen name="[id]" options={{ title: "Account details" }} />
    </Stack>
  );
}
