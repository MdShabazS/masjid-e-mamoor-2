import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth/AuthProvider";
import { QueryProvider } from "../src/query/QueryProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <QueryProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
