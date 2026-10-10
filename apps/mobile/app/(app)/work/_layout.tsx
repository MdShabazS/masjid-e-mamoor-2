import { Stack } from "expo-router";

import { colors } from "../../../src/theme/colors";

export default function WorkLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.ivory },
        headerBackTitle: "Work",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.ivory },
        headerTintColor: colors.deepEmerald,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ title: "Create task" }} />
      <Stack.Screen name="[id]/index" options={{ title: "Task details" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit task" }} />
      <Stack.Screen name="meetings/index" options={{ headerShown: false }} />
      <Stack.Screen name="meetings/create" options={{ title: "Create meeting" }} />
      <Stack.Screen name="meetings/[id]/index" options={{ title: "Meeting details" }} />
      <Stack.Screen name="meetings/[id]/edit" options={{ title: "Edit meeting" }} />
    </Stack>
  );
}
