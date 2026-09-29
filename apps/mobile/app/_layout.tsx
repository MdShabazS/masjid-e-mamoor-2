import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth/AuthProvider";
import { QueryProvider } from "../src/query/QueryProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryProvider>
    </AuthProvider>
  );
}
