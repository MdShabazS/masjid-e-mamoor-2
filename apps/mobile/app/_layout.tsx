import { useEffect } from "react";
import { SplashScreen, Stack } from "expo-router";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AuthProvider } from "../src/auth/AuthProvider";
import { ReleaseGate } from "../src/components/ReleaseGate";
import { NotificationPushRegistration } from "../src/components/NotificationPushRegistration";
import { QueryProvider } from "../src/query/QueryProvider";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AuthProvider>
          <QueryProvider>
            <NotificationPushRegistration />
            <ReleaseGate>
              <Stack screenOptions={{ headerShown: false }} />
            </ReleaseGate>
          </QueryProvider>
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
