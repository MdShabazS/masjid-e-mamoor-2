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
        name="index"
        options={{ title: "Finance" }}
      />
      <Stack.Screen
        name="accounts/index"
        options={{ title: "Finance accounts" }}
      />
      <Stack.Screen
        name="transactions/index"
        options={{ title: "Finance transactions" }}
      />
      <Stack.Screen
        name="transfers/index"
        options={{ title: "Finance transfers" }}
      />
      <Stack.Screen
        name="expenses/index"
        options={{ title: "Finance expenses" }}
      />
      <Stack.Screen
        name="reports/index"
        options={{ title: "Monthly reports" }}
      />
    </Stack>
  );
}
