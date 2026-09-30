import { Stack } from "expo-router";
import { colors } from "../../../src/theme/colors";

export default function DonationsLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.ivory },
        headerBackTitle: "Donations",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.ivory },
        headerTintColor: colors.deepEmerald,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="payment/[id]" options={{ title: "Payment details" }} />
      <Stack.Screen name="manage/index" options={{ title: "Donation management" }} />
    </Stack>
  );
}
