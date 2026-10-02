import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountUsernameChangeSchema } from "@masjid-e-mamoor/validation";
import { useAuth } from "../../../src/auth/AuthProvider";
import {
  accountDirectoryQueryKey,
  accountStatusLabel,
  availableAccountRoles,
  canAccessAccountAdministration,
  canChangeAccountStatus,
  changeManagedAccountRole,
  changeManagedAccountStatus,
  changeManagedAccountUsername,
  isProtectedSystemAdminTarget,
  listManagedAccounts,
  resetManagedAccountPassword,
  type AccountProvisionRole,
} from "../../../src/modules/accounts";
import { colors, roleLabels } from "../../../src/theme/colors";
import { FormTextInput, Screen } from "../../../src/components/Screen";

export default function AccountDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const accountId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { account, session } = useAuth();
  const queryClient = useQueryClient();
  const authorized = Boolean(
    account && canAccessAccountAdministration(account.role),
  );
  const directoryKey = accountDirectoryQueryKey(account?.id);
  const accounts = useQuery({
    queryKey: directoryKey,
    queryFn: () => listManagedAccounts(session!),
    enabled: authorized && Boolean(session),
  });
  const target = accounts.data?.find((item) => item.id === accountId);
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const [selectedRoleDraft, setSelectedRoleDraft] =
    useState<AccountProvisionRole | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );

  const refreshDirectory = () =>
    queryClient.invalidateQueries({ queryKey: directoryKey });

  const changeUsername = useMutation({
    mutationFn: async () => {
      const parsed = accountUsernameChangeSchema.safeParse({
        accountId,
        username: usernameDraft ?? target?.username ?? "",
      });
      if (!parsed.success) throw new Error("invalid_input");
      await changeManagedAccountUsername(
        session!,
        parsed.data.accountId,
        parsed.data.username,
      );
    },
    onSuccess: refreshDirectory,
    onError: (error) =>
      Alert.alert(
        "Username could not be changed",
        error.message === "invalid_input"
          ? "Check the username and try again."
          : "Please try again.",
      ),
  });

  const changeRole = useMutation({
    mutationFn: async () => {
      const role =
        selectedRoleDraft ??
        (target && target.role !== "system_admin" ? target.role : "member");
      await changeManagedAccountRole(session!, accountId, role);
    },
    onSuccess: refreshDirectory,
    onError: () =>
      Alert.alert("Role could not be changed", "Please try again."),
  });

  const changeStatus = useMutation({
    mutationFn: async (status: "active" | "deactivated") => {
      await changeManagedAccountStatus(session!, accountId, status);
    },
    onSuccess: refreshDirectory,
    onError: () =>
      Alert.alert("Account status could not be updated", "Please try again."),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      const result = await resetManagedAccountPassword(session!, accountId);
      setTemporaryPassword(result.temporaryPassword);
    },
    onSuccess: refreshDirectory,
    onError: () =>
      Alert.alert("Password could not be reset", "Please try again."),
  });

  if (!account || !session) return null;
  if (!authorized) return <AccessState />;
  if (accounts.isLoading) return <LoadingState />;
  if (accounts.isError || !target) {
    return <ErrorState onRetry={() => void accounts.refetch()} />;
  }

  const protectedRole = isProtectedSystemAdminTarget(target);
  const statusChangeAllowed = canChangeAccountStatus(
    account.id,
    target,
    accounts.data ?? [],
  );
  const nextStatus = target.status === "active" ? "deactivated" : "active";
  const roleOptions = availableAccountRoles(account.role);
  const username = usernameDraft ?? target.username ?? "";
  const selectedRole =
    selectedRoleDraft ??
    (target.role !== "system_admin" ? target.role : "member");

  function confirmRoleChange() {
    Alert.alert(
      "Change role?",
      `This will change the account role to ${roleLabels[selectedRole]}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Change role", onPress: () => changeRole.mutate() },
      ],
    );
  }

  function confirmStatusChange() {
    const deactivating = nextStatus === "deactivated";
    Alert.alert(
      deactivating ? "Deactivate account?" : "Reactivate account?",
      deactivating
        ? "This user will lose application access until the account is reactivated."
        : "This user will regain application access.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: deactivating ? "Deactivate" : "Reactivate",
          style: deactivating ? "destructive" : "default",
          onPress: () => changeStatus.mutate(nextStatus),
        },
      ],
    );
  }

  function confirmPasswordReset() {
    Alert.alert(
      "Reset password?",
      "A new temporary password will replace the current password. The user must change it on first login.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset password", onPress: () => resetPassword.mutate() },
      ],
    );
  }

  return (
    <Screen contentContainerStyle={styles.content} edges={["left", "right", "bottom"]} keyboardAware scroll>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>{target.username ?? "Username not set"}</Text>
        {target.displayName ? (
          <Text style={styles.intro}>{target.displayName}</Text>
        ) : null}

        <View style={styles.summaryCard}>
          <Detail label="Role" value={roleLabels[target.role]} />
          <Detail label="Status" value={accountStatusLabel(target.status)} />
          <Detail
            label="Password setup"
            value={target.mustChangePassword ? "Pending" : "Complete"}
          />
          <Detail label="Created" value={formatDate(target.createdAt)} />
          <Detail
            label="Credential changed"
            value={formatDate(target.credentialUpdatedAt)}
          />
        </View>

        {temporaryPassword ? (
          <View style={styles.credentialSection}>
            <Text style={styles.credentialTitle}>Temporary password</Text>
            <Text style={styles.credentialHelp}>
              Share it securely. It will disappear when dismissed or when you
              leave this screen.
            </Text>
            <Text selectable style={styles.credential}>
              {temporaryPassword}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(temporaryPassword);
                  Alert.alert("Copied", "The temporary password was copied.");
                }}
                style={styles.credentialButton}
              >
                <Text style={styles.credentialButtonText}>Copy</Text>
              </Pressable>
              <Pressable
                onPress={() => setTemporaryPassword(null)}
                style={styles.credentialButton}
              >
                <Text style={styles.credentialButtonText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Username</Text>
        <FormTextInput
          autoCapitalize="none"
          onChangeText={setUsernameDraft}
          placeholder="Username"
          placeholderTextColor="#93A099"
          style={styles.input}
          value={username}
        />
        <Pressable
          disabled={changeUsername.isPending}
          onPress={() => changeUsername.mutate()}
          style={[
            styles.secondaryButton,
            changeUsername.isPending && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            {changeUsername.isPending ? "Saving..." : "Save username"}
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Role</Text>
        {protectedRole ? (
          <View style={styles.protectedPanel}>
            <Text style={styles.protectedTitle}>System Admin</Text>
            <Text style={styles.help}>
              This protected system role cannot be reassigned from ordinary
              mobile controls.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.optionGrid}>
              {roleOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setSelectedRoleDraft(option)}
                  style={[
                    styles.option,
                    selectedRole === option && styles.optionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedRole === option && styles.optionTextSelected,
                    ]}
                  >
                    {roleLabels[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={changeRole.isPending || selectedRole === target.role}
              onPress={confirmRoleChange}
              style={[
                styles.secondaryButton,
                (changeRole.isPending || selectedRole === target.role) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {changeRole.isPending ? "Saving..." : "Save role"}
              </Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>Account access</Text>
        {statusChangeAllowed ? (
          <Pressable
            disabled={changeStatus.isPending}
            onPress={confirmStatusChange}
            style={[
              styles.statusButton,
              nextStatus === "deactivated" && styles.dangerButton,
              changeStatus.isPending && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.statusButtonText,
                nextStatus === "deactivated" && styles.dangerButtonText,
              ]}
            >
              {changeStatus.isPending
                ? "Updating..."
                : nextStatus === "active"
                  ? "Reactivate account"
                  : "Deactivate account"}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.protectedPanel}>
            <Text style={styles.protectedTitle}>Active status protected</Text>
            <Text style={styles.help}>
              The signed-in or final active System Admin cannot be deactivated.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Password</Text>
        <Text style={styles.help}>
          Generate a new temporary password and require a password change at
          the next login.
        </Text>
        <Pressable
          disabled={resetPassword.isPending}
          onPress={confirmPasswordReset}
          style={[
            styles.secondaryButton,
            resetPassword.isPending && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            {resetPassword.isPending ? "Resetting..." : "Reset password"}
          </Text>
        </Pressable>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString();
}

function LoadingState() {
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.deepEmerald} />
        <Text style={styles.help}>Loading account...</Text>
      </View>
    </SafeAreaView>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Account is not available</Text>
        <Text style={styles.help}>
          It may be outside your authorized scope. Refresh and try again.
        </Text>
        <Pressable onPress={onRetry} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function AccessState() {
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.page}>
      <View style={styles.centerState}>
        <Text style={styles.stateTitle}>Account Administration</Text>
        <Text style={styles.help}>
          Account management is not available for your account.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.ivory, flex: 1 },
  content: { padding: 20, paddingBottom: 50 },
  centerState: { alignItems: "center", flex: 1, justifyContent: "center", padding: 24 },
  eyebrow: { color: colors.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 8 },
  intro: { color: colors.secondary, fontSize: 14, marginTop: 5 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  detailLabel: { color: colors.secondary, flex: 1, fontSize: 13 },
  detailValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: "600", textAlign: "right" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 10, marginTop: 26 },
  help: { color: colors.secondary, fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: "left" },
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
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.deepEmerald,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  secondaryButtonText: { color: colors.deepEmerald, fontSize: 14, fontWeight: "700" },
  statusButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusButtonText: { color: colors.surface, fontSize: 14, fontWeight: "700" },
  dangerButton: { backgroundColor: "#F7E4E2", borderColor: "#D9A6A2", borderWidth: 1 },
  dangerButtonText: { color: colors.danger },
  protectedPanel: { backgroundColor: colors.sand, borderRadius: 12, padding: 15 },
  protectedTitle: { color: colors.deepEmerald, fontSize: 14, fontWeight: "700" },
  credentialSection: {
    backgroundColor: colors.darkEmerald,
    borderRadius: 14,
    marginTop: 20,
    padding: 16,
  },
  credentialTitle: { color: colors.surface, fontSize: 18, fontWeight: "700" },
  credentialHelp: { color: "#C8D7D0", fontSize: 13, lineHeight: 19, marginTop: 6 },
  credential: { color: colors.surface, fontFamily: "monospace", fontSize: 18, marginTop: 14, textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: 10 },
  credentialButton: {
    alignItems: "center",
    borderColor: colors.gold,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  credentialButtonText: { color: colors.surface, fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: "700", textAlign: "center" },
});
