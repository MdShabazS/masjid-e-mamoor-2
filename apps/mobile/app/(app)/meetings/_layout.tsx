import { Stack } from "expo-router";

import { colors } from "../../../src/theme/colors";

export default function MeetingsLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.ivory },
        headerBackTitle: "Meetings",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.ivory },
        headerTintColor: colors.deepEmerald,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: "Create meeting" }} />
      <Stack.Screen name="[id]/index" options={{ title: "Meeting details" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit meeting" }} />
    </Stack>
  );
}
