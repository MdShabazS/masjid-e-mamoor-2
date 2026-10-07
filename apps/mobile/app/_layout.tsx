import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider } from "../src/auth/AuthProvider";
import { ReleaseGate } from "../src/components/ReleaseGate";
import { QueryProvider } from "../src/query/QueryProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AuthProvider>
          <QueryProvider>
            <ReleaseGate>
              <Stack screenOptions={{ headerShown: false }} />
            </ReleaseGate>
          </QueryProvider>
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
