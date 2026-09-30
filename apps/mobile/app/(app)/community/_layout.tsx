import { Stack } from "expo-router";

export default function CommunityLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="members/index" options={{ title: "Members" }} />
      <Stack.Screen name="members/[id]" options={{ title: "Member Detail" }} />
      <Stack.Screen name="referrals/index" options={{ title: "Referrals" }} />
    </Stack>
  );
}
