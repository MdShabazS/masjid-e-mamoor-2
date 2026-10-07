import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import {
  getMobileReleaseStatus,
  mobileReleaseQueryKey,
  safeHttpsStoreUrl,
} from "../modules/release";
import { colors } from "../theme/colors";
import { radii, spacing, touchTargets, typography } from "../theme/tokens";

export function ReleaseGate({ children }: PropsWithChildren) {
  const release = useQuery({
    queryKey: mobileReleaseQueryKey,
    queryFn: () => getMobileReleaseStatus(),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
  const [dismissedLatestVersion, setDismissedLatestVersion] = useState<string | null>(null);
  const refetchRef = useRef(release.refetch);
  const fetchingRef = useRef(release.isFetching);

  useEffect(() => {
    refetchRef.current = release.refetch;
    fetchingRef.current = release.isFetching;
  }, [release.isFetching, release.refetch]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !fetchingRef.current) {
        void refetchRef.current({ cancelRefetch: false });
      }
    });

    return () => subscription.remove();
  }, []);

  const status = release.data;
  const storeUrl = safeHttpsStoreUrl(status?.storeUrl, status?.platform);

  if (status?.updateStatus === "required") {
    return (
      <RequiredUpdateScreen
        currentVersion={status.currentVersion}
        latestVersion={status.latestVersion}
        minimumSupportedVersion={status.minimumSupportedVersion}
        message={status.updateMessage}
        storeUrl={storeUrl}
        retrying={release.isFetching}
        onRetry={() => {
          if (!fetchingRef.current) {
            void refetchRef.current({ cancelRefetch: false });
          }
        }}
      />
    );
  }

  const showOptional =
    status?.updateStatus === "optional" && dismissedLatestVersion !== status.latestVersion;

  return (
    <>
      {children}
      {status?.updateStatus === "optional" ? (
        <Modal
          animationType="fade"
          transparent
          visible={showOptional}
          onRequestClose={() => setDismissedLatestVersion(status.latestVersion)}
        >
          <View style={styles.modalBackdrop}>
            <View accessibilityRole="alert" accessibilityViewIsModal style={styles.prompt}>
              <Text style={styles.eyebrow}>UPDATE AVAILABLE</Text>
              <Text style={styles.promptTitle}>A newer version is ready</Text>
              <Text style={styles.message}>{status.updateMessage}</Text>
              <Text style={styles.versionCopy}>Version {status.latestVersion} is available.</Text>
              <View style={styles.promptActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDismissedLatestVersion(status.latestVersion)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Later</Text>
                </Pressable>
                {storeUrl ? <StoreButton label="Update now" storeUrl={storeUrl} /> : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function RequiredUpdateScreen({
  currentVersion,
  latestVersion,
  minimumSupportedVersion,
  message,
  storeUrl,
  retrying,
  onRetry,
}: {
  currentVersion: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  message: string;
  storeUrl: string | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <SafeAreaView style={styles.requiredPage}>
      <View accessibilityRole="alert" style={styles.requiredPanel}>
        <View style={styles.brandMark} />
        <Text style={styles.eyebrow}>UPDATE REQUIRED</Text>
        <Text style={styles.requiredTitle}>Please update to continue</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.versionPanel}>
          <VersionRow label="Installed" value={currentVersion} />
          <VersionRow label="Minimum required" value={minimumSupportedVersion} />
          <VersionRow label="Latest" value={latestVersion} />
        </View>

        {storeUrl ? (
          <StoreButton label="Update app" storeUrl={storeUrl} />
        ) : (
          <>
            <Text style={styles.supportCopy}>
              The app store link is not available. Please contact support or retry after the release
              configuration is corrected.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={retrying}
              onPress={onRetry}
              style={[styles.primaryButton, retrying && styles.buttonDisabled]}
            >
              {retrying ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>Retry</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function StoreButton({ label, storeUrl }: { label: string; storeUrl: string }) {
  const [openingFailed, setOpeningFailed] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          setOpeningFailed(false);
          void Linking.openURL(storeUrl).catch(() => setOpeningFailed(true));
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
      </Pressable>
      {openingFailed ? (
        <Text accessibilityRole="alert" style={styles.openError}>
          The app store could not be opened. Please try again.
        </Text>
      ) : null}
    </View>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.versionRow}>
      <Text style={styles.versionLabel}>{label}</Text>
      <Text style={styles.versionValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  requiredPage: {
    alignItems: "center",
    backgroundColor: colors.ivory,
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  requiredPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: radii.card,
    borderWidth: 1,
    maxWidth: 480,
    padding: spacing.xxl,
    width: "100%",
  },
  brandMark: {
    backgroundColor: colors.gold,
    borderRadius: 5,
    height: 22,
    marginBottom: spacing.xl,
    transform: [{ rotate: "45deg" }],
    width: 22,
  },
  eyebrow: {
    color: colors.deepEmerald,
    ...typography.eyebrow,
  },
  requiredTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  promptTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  message: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  versionCopy: {
    color: colors.secondary,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  versionPanel: {
    backgroundColor: colors.ivory,
    borderRadius: radii.panel,
    marginVertical: spacing.xl,
    padding: spacing.md,
  },
  versionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  versionLabel: { color: colors.secondary, fontSize: 13 },
  versionValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  supportCopy: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.deepEmerald,
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryButtonText: { color: colors.surface, ...typography.action },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.deepEmerald,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: touchTargets.comfortable,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: { color: colors.deepEmerald, ...typography.action },
  buttonDisabled: { opacity: 0.65 },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(11, 45, 38, 0.56)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  prompt: {
    backgroundColor: colors.surface,
    borderColor: colors.sand,
    borderRadius: radii.card,
    borderWidth: 1,
    maxWidth: 480,
    padding: spacing.xxl,
    width: "100%",
  },
  promptActions: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "flex-end",
    marginTop: spacing.xl,
  },
  openError: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
