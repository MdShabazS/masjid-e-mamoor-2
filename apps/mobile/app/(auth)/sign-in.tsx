import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors } from "../../src/theme/colors";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      router.replace("/(app)");
    } catch {
      setError("The username or password is incorrect.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}>
          <View style={styles.brandMarkInner} />
        </View>
        <Text style={styles.eyebrow}>MASJID E MAMOOR 2</Text>
        <Text style={styles.title}>Management System</Text>
        <Text style={styles.supporting}>
          Serving the Masjid with clarity, trust and accountability.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="#9EA9A3"
            style={styles.input}
            textContentType="username"
            value={username}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#9EA9A3"
            secureTextEntry
            style={styles.input}
            textContentType="password"
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{submitting ? "Signing in..." : "Sign In"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.darkEmerald },
  content: { flexGrow: 1, justifyContent: "center", padding: 28 },
  brandMark: {
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: 18,
    height: 58,
    justifyContent: "center",
    marginBottom: 28,
    width: 58,
  },
  brandMarkInner: {
    borderColor: colors.darkEmerald,
    borderWidth: 2,
    height: 26,
    transform: [{ rotate: "45deg" }],
    width: 26,
  },
  eyebrow: { color: colors.gold, fontSize: 13, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: colors.surface, fontSize: 30, fontWeight: "700", marginTop: 8 },
  supporting: { color: "#C8D7D0", fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 320 },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginTop: 32,
    padding: 20,
  },
  label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  input: {
    borderColor: "#D8DED8",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    height: 52,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: 14 },
  button: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    height: 52,
    justifyContent: "center",
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
});
