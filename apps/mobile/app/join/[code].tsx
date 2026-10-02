import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  submitPublicReferralOnboarding,
  validatePublicReferralCode,
} from "../../src/modules/public-referral";
import { colors } from "../../src/theme/colors";

export default function PublicJoinScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code ?? "";
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const referral = useQuery({
    queryKey: ["public-referral", code],
    queryFn: () => validatePublicReferralCode(code),
    enabled: Boolean(code),
    retry: false,
  });
  const submit = useMutation({
    mutationFn: () => submitPublicReferralOnboarding(code, displayName, phone),
    onSuccess: () => setSubmitted(true),
  });

  if (referral.isLoading) {
    return <StateScreen text="Checking referral..." loading />;
  }

  if (!referral.data?.valid) {
    return (
      <StateScreen
        text="This referral link is invalid or unavailable."
        detail="Ask the person who shared it for a current referral link."
      />
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MASJID E MAMOOR 2</Text>
        <Text style={styles.title}>Request membership</Text>
        {referral.data.referrerDisplayName ? (
          <Text style={styles.intro}>Referred by {referral.data.referrerDisplayName}</Text>
        ) : null}
        {submitted ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Request submitted</Text>
            <Text style={styles.body}>
              Your onboarding request has been sent for review. An account will be provided only after approval.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>Enter your name and phone number. No account is created at this step.</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setDisplayName}
              placeholder="Full name"
              placeholderTextColor="#9EA9A3"
              style={styles.input}
              value={displayName}
            />
            <Text style={styles.label}>Phone</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="+919876543210"
              placeholderTextColor="#9EA9A3"
              style={styles.input}
              value={phone}
            />
            {submit.isError ? <Text style={styles.error}>This request could not be submitted. Check the details and try again.</Text> : null}
            <Pressable disabled={submit.isPending} onPress={() => submit.mutate()} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{submit.isPending ? "Submitting..." : "Submit request"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StateScreen({ text, detail, loading = false }: { text: string; detail?: string; loading?: boolean }) {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.state}>
        {loading ? <ActivityIndicator color={colors.deepEmerald} /> : null}
        <Text style={styles.stateTitle}>{text}</Text>
        {detail ? <Text style={styles.body}>{detail}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 14, marginTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: 14, marginTop: 24, padding: 18 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  body: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginTop: 10 },
  label: { color: colors.secondary, fontSize: 12, fontWeight: "700", marginTop: 18 },
  input: { borderColor: "#D8DED8", borderRadius: 9, borderWidth: 1, color: colors.text, height: 48, marginTop: 7, paddingHorizontal: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 14 },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 50, justifyContent: "center", marginTop: 22 },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  state: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 14, textAlign: "center" },
});
