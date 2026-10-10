import { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";
import type { MobileMemberProfile } from "../../src/auth/types";
import { updateOwnMemberProfile } from "../../src/modules/data";
import { FormTextInput, Screen } from "../../src/components/Screen";
import {
  BrandedPageHeader,
  StatusChip,
} from "../../src/components/InstitutionalUI";
import { colors, roleLabels } from "../../src/theme/colors";
import { spacing } from "../../src/theme/tokens";
import {
  buildSupportEmailUrl,
  SUPPORT_EMAIL,
} from "../../src/lib/support";

export default function ProfileScreen() {
  const { account, refreshAccount, signOut } = useAuth();
  if (!account) return null;

  const accountRoleLabel = roleLabels[account.role];

  async function contactSupport() {
    const url = buildSupportEmailUrl({
      appVersion:
        Constants.nativeAppVersion ??
        Constants.expoConfig?.version ??
        "Unavailable",
      buildVersion: Constants.nativeBuildVersion ?? "Unavailable",
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      role: accountRoleLabel,
    });

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Email app unavailable",
        `Contact support at ${SUPPORT_EMAIL}.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Copy email",
            onPress: () => void Clipboard.setStringAsync(SUPPORT_EMAIL),
          },
        ],
      );
    }
  }

  return (
    <Screen contentContainerStyle={styles.content} keyboardAware scroll>
      <StatusBar style="dark" />
      <BrandedPageHeader
        eyebrow="Account"
        title="Profile"
        description="Review your account, membership details, security access, and support options."
      />
      <View style={styles.card}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>{account.username ?? "Not set"}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{roleLabels[account.role]}</Text>
        <Text style={styles.label}>Account status</Text>
        <StatusChip label="Active" tone="success" />

        <Text style={styles.label}>Password status</Text>
        <StatusChip
          label={
            account.mustChangePassword
              ? "Change required"
              : "Up to date"
          }
          tone={
            account.mustChangePassword
              ? "warning"
              : "success"
          }
        />
      </View>
      {account.memberProfile ? <MemberProfileEditor profile={account.memberProfile} onSaved={() => void refreshAccount()} /> : <View style={styles.card}><Text style={styles.cardTitle}>Membership details</Text><Text style={styles.value}>Administrative account — no member membership record is attached.</Text></View>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Help & Support</Text>
        <Text style={styles.supportCopy}>
          If something is not working correctly, report the problem directly to the app developer.
        </Text>

        <Text style={styles.label}>Support email</Text>
        <Text selectable style={styles.value}>
          {SUPPORT_EMAIL}
        </Text>

        <Text style={styles.supportNote}>
          The email draft includes only app version, build, platform, OS version,
          and your role. Do not send passwords, OTPs, payment credentials, or
          other sensitive information.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void contactSupport()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Report a problem</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Clipboard.setStringAsync(SUPPORT_EMAIL);
            Alert.alert("Copied", "Support email copied.");
          }}
          style={({ pressed }) => [
            styles.secondaryOutlineButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryOutlineButtonText}>
            Copy support email
          </Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/change-password")} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>Change password</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

function MemberProfileEditor({
  profile,
  onSaved,
}: {
  profile: MobileMemberProfile;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(
    profile.displayName,
  );
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;

    setSaving(true);

    try {
      await updateOwnMemberProfile(
        displayName,
        phone.trim() || null,
      );

      onSaved();

      Alert.alert(
        "Profile updated",
        "Your membership details were saved.",
      );
    } catch {
      Alert.alert(
        "Could not save",
        "Check the details and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        Membership details
      </Text>

      <Text style={styles.label}>
        Membership status
      </Text>

      <StatusChip
        label={
          profile.status === "active"
            ? "Active"
            : "Inactive"
        }
        tone={
          profile.status === "active"
            ? "success"
            : "danger"
        }
      />

      <Text style={styles.label}>
        Display name
      </Text>

      <FormTextInput
        accessibilityLabel="Display name"
        onChangeText={setDisplayName}
        returnKeyType="next"
        style={styles.input}
        value={displayName}
      />

      <Text style={styles.label}>
        Phone
      </Text>

      <FormTextInput
        accessibilityLabel="Phone"
        autoCapitalize="none"
        keyboardType="phone-pad"
        onChangeText={setPhone}
        returnKeyType="done"
        style={styles.input}
        value={phone}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        disabled={saving}
        onPress={() => void save()}
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || saving) && styles.pressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {saving
            ? "Saving..."
            : "Save membership details"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.xxl, paddingBottom: spacing.section },
  eyebrow: { color: colors.deepEmerald, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 30, fontWeight: "700", marginTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    padding: 18,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  label: { color: colors.secondary, fontSize: 12, fontWeight: "700", marginTop: 14 },
  value: { color: colors.text, fontSize: 16, marginTop: 4 },
  input: { borderColor: "#D8DED8", borderRadius: 9, borderWidth: 1, color: colors.text, height: 48, marginTop: 7, paddingHorizontal: 12 },
  success: { color: colors.success, fontWeight: "700" },
  inactive: { color: colors.danger, fontWeight: "700" },
  primaryButton: { alignItems: "center", backgroundColor: colors.deepEmerald, borderRadius: 10, height: 50, justifyContent: "center", marginTop: 22 },
  primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: "700" },
  secondaryButton: { alignItems: "center", height: 48, justifyContent: "center", marginTop: 8 },
  secondaryButtonText: { color: colors.secondary, fontSize: 15, fontWeight: "700" },
  supportCopy: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginTop: 4 },
  supportNote: { color: colors.secondary, fontSize: 12, lineHeight: 18, marginTop: 12 },
  secondaryOutlineButton: {
    alignItems: "center",
    borderColor: colors.deepEmerald,
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryOutlineButtonText: {
    color: colors.deepEmerald,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: { opacity: 0.7 },
});
