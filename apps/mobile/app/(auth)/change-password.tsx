import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors } from "../../src/theme/colors";
import { FormTextInput, Screen } from "../../src/components/Screen";

export default function ChangePasswordScreen() {
  const { changePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await changePassword(password, confirmPassword);
      router.replace("/(auth)/sign-in");
    } catch {
      setError("The password could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentContainerStyle={styles.content} keyboardAware scroll>
      <StatusBar style="dark" />
        <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
        <Text style={styles.title}>Set a new password before continuing.</Text>
        <Text style={styles.copy}>Choose a password you will remember. This step is required for your account.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>New password</Text>
          <FormTextInput
            autoCapitalize="none"
            autoComplete="new-password"
            importantForAutofill="yes"
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            textContentType="newPassword"
            value={password}
          />
          <Text style={styles.label}>Confirm password</Text>
          <FormTextInput
            autoCapitalize="none"
            autoComplete="new-password"
            importantForAutofill="yes"
            onChangeText={setConfirmPassword}
            secureTextEntry
            style={styles.input}
            textContentType="newPassword"
            value={confirmPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable disabled={saving} onPress={submit} style={styles.button}>
            <Text style={styles.buttonText}>{saving ? "Updating..." : "Continue"}</Text>
          </Pressable>
          <Pressable onPress={() => void signOut()} style={styles.signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", padding: 28 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "700", letterSpacing: 1.3 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", lineHeight: 37, marginTop: 10 },
  copy: { color: colors.secondary, fontSize: 15, lineHeight: 22, marginTop: 12 },
  form: { backgroundColor: colors.surface, borderRadius: 18, marginTop: 28, padding: 20 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  input: { borderColor: "#D8DED8", borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, height: 52, marginBottom: 16, paddingHorizontal: 14 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  button: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 52, justifyContent: "center" },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  signOut: { alignItems: "center", marginTop: 18, padding: 6 },
  signOutText: { color: colors.secondary, fontSize: 14, fontWeight: "600" },
});
