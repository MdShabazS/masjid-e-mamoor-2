import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  type TextInputProps,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountCreateSchema } from "@masjid-e-mamoor/validation";
import { useAuth } from "../../../src/auth/AuthProvider";
import {
  accountDirectoryQueryKey,
  availableAccountRoles,
  canAccessAccountAdministration,
  createManagedAccount,
  initialAccountCreationDraft,
  type AccountProvisionRole,
} from "../../../src/modules/accounts";
import { colors, roleLabels } from "../../../src/theme/colors";
import { FormTextInput, Screen } from "../../../src/components/Screen";

export default function CreateAccountScreen() {
  const { account, session } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(
    () => initialAccountCreationDraft().username,
  );
  const [role, setRole] = useState<AccountProvisionRole>(
    () => initialAccountCreationDraft().role,
  );
  const [displayName, setDisplayName] = useState(
    () => initialAccountCreationDraft().displayName,
  );
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [formRevision, setFormRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const draft = initialAccountCreationDraft();
      setUsername(draft.username);
      setRole(draft.role);
      setDisplayName(draft.displayName);
      setTemporaryPassword(null);
      setFormRevision((current) => current + 1);
    }, []),
  );

  const create = useMutation({
    mutationFn: async () => {
      const parsed = accountCreateSchema.safeParse({
        username,
        role,
        ...(role === "member" && displayName.trim()
          ? { displayName: displayName.trim() }
          : {}),
      });
      if (!parsed.success) throw new Error("invalid_input");

      const result = await createManagedAccount(session!, parsed.data);
      setTemporaryPassword(result.temporaryPassword);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: accountDirectoryQueryKey(account?.id),
      }),
    onError: (error) => {
      Alert.alert(
        "Account could not be created",
        error.message === "invalid_input"
          ? "Check the username and account details."
          : "Check the details and try again.",
      );
    },
  });

  if (!account || !session) return null;
  if (!canAccessAccountAdministration(account.role)) {
    return <AccessState />;
  }

  const roleOptions = availableAccountRoles(account.role);

  if (temporaryPassword) {
    return (
      <Screen edges={["left", "right", "bottom"]} contentContainerStyle={styles.resultWrap}>
          <Text style={styles.eyebrow}>ACCOUNT CREATED</Text>
          <Text style={styles.title}>Temporary password</Text>
          <Text style={styles.help}>
            Share this password securely. The user must change it on first
            login. It will not remain available after you leave this screen.
          </Text>
          <View style={styles.credentialPanel}>
            <Text selectable style={styles.credential}>
              {temporaryPassword}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void Clipboard.setStringAsync(temporaryPassword);
              Alert.alert("Copied", "The temporary password was copied.");
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Copy password</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTemporaryPassword(null);
              router.replace("/accounts");
            }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content} edges={["left", "right", "bottom"]} keyboardAware scroll>
        <Text style={styles.eyebrow}>PROVISIONING</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.help}>
          Create access only when the person is ready to receive their login.
        </Text>

        <Field
          autoCapitalize="none"
          autoComplete="off"
          importantForAutofill="no"
          key={`username-${formRevision}`}
          label="Username"
          onChangeText={setUsername}
          placeholder="username"
          value={username}
        />

        <Text style={styles.fieldLabel}>Role</Text>
        <View style={styles.optionGrid}>
          {roleOptions.map((option) => (
            <Pressable
              key={option}
              onPress={() => setRole(option)}
              style={[
                styles.option,
                option === role && styles.optionSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  option === role && styles.optionTextSelected,
                ]}
              >
                {roleLabels[option]}
              </Text>
            </Pressable>
          ))}
        </View>

        {role === "member" ? (
          <Field
            label="Display name"
            onChangeText={setDisplayName}
            placeholder="Member display name"
            value={displayName}
          />
        ) : null}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Password setup</Text>
          <Text style={styles.noticeCopy}>
            A strong temporary password will be generated and shown once after
            the account is created.
          </Text>
        </View>

        <Pressable
          disabled={create.isPending}
          onPress={() => create.mutate()}
          style={({ pressed }) => [styles.primaryButton, (pressed || create.isPending) && styles.disabled]}
        >
          <Text style={styles.primaryButtonText}>
            {create.isPending ? "Creating..." : "Create account"}
          </Text>
        </Pressable>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & Pick<
  TextInputProps,
  | "autoCapitalize"
  | "autoComplete"
  | "importantForAutofill"
  | "onChangeText"
  | "placeholder"
  | "value"
>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <FormTextInput
        {...props}
        placeholderTextColor="#93A099"
        style={styles.input}
      />
    </View>
  );
}

function AccessState() {
  return (
    <Screen edges={["left", "right", "bottom"]} contentContainerStyle={styles.resultWrap}>
        <Text style={styles.title}>Account Administration</Text>
        <Text style={styles.help}>
          Account creation is not available for your account.
        </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  resultWrap: { padding: 24 },
  eyebrow: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 8 },
  help: { color: colors.secondary, fontSize: 14, lineHeight: 21, marginTop: 8 },
  field: { marginTop: 18 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 18 },
  input: {
    backgroundColor: colors.surface,
    borderColor: "#D9D3C6",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    backgroundColor: colors.surface,
    borderColor: "#D9D3C6",
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionSelected: { backgroundColor: colors.deepEmerald, borderColor: colors.deepEmerald },
  optionText: { color: colors.secondary, fontSize: 13, fontWeight: "600" },
  optionTextSelected: { color: colors.surface },
  notice: {
    backgroundColor: colors.sand,
    borderRadius: 12,
    marginTop: 22,
    padding: 15,
  },
  noticeTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  noticeCopy: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  credentialPanel: {
    backgroundColor: colors.darkEmerald,
    borderRadius: 12,
    marginTop: 22,
    padding: 18,
  },
  credential: { color: colors.surface, fontFamily: "monospace", fontSize: 18, textAlign: "center" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.deepEmerald,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: colors.deepEmerald, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
