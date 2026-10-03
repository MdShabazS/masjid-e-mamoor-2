import { Stack } from "expo-router";

import { colors } from "../../../src/theme/colors";

export default function FinanceLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: {
          backgroundColor: colors.ivory,
        },
        headerBackTitle: "Home",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.ivory,
        },
        headerTintColor: colors.deepEmerald,
      }}
    >
      <Stack.Screen
        name="accounts/index"
        options={{ title: "Finance accounts" }}
      />
    </Stack>
  );
}
