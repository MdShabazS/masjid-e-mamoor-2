import * as Application from "expo-application";
import { Platform } from "react-native";

import { supabase } from "../lib/supabase";

type DbRow = Record<string, unknown>;

export type MobileReleasePlatform = "android" | "ios";
export type MobileUpdateStatus = "none" | "optional" | "required";

export interface NativeReleaseIdentity {
  platform: MobileReleasePlatform;
  currentVersion: string;
}

export interface MobileReleaseStatus extends NativeReleaseIdentity {
  latestVersion: string;
  minimumSupportedVersion: string;
  updateStatus: MobileUpdateStatus;
  storeUrl: string | null;
  updateMessage: string;
  policyUpdatedAt: string;
}

const nativeVersionPattern = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;

export const mobileReleaseQueryKey = ["mobile-release-status"] as const;

export function resolveNativeReleaseIdentity(
  platform = Platform.OS,
  nativeVersion = Application.nativeApplicationVersion,
): NativeReleaseIdentity | null {
  if (platform !== "android" && platform !== "ios") return null;

  const currentVersion = nativeVersion?.trim();
  if (!currentVersion || !nativeVersionPattern.test(currentVersion)) {
    return null;
  }

  return { platform, currentVersion };
}

export async function getMobileReleaseStatus(
  identity = resolveNativeReleaseIdentity(),
): Promise<MobileReleaseStatus | null> {
  if (!identity) return null;

  const { data, error } = await supabase.rpc("get_mobile_release_status", {
    p_platform: identity.platform,
    p_current_version: identity.currentVersion,
  });

  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("release_status_unavailable");
  }

  return mapReleaseStatus(row as DbRow);
}

export function safeHttpsStoreUrl(
  value: string | null | undefined,
  platform: MobileReleasePlatform | null | undefined,
) {
  if (!value || !platform) return null;

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return null;
    }

    const allowedHost = platform === "android" ? "play.google.com" : "apps.apple.com";

    return url.hostname === allowedHost ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapReleaseStatus(row: DbRow): MobileReleaseStatus {
  const platform = String(row.platform);
  const currentVersion = String(row.current_version);
  const latestVersion = String(row.latest_version);
  const minimumSupportedVersion = String(row.minimum_supported_version);
  const updateStatus = String(row.update_status);
  const updateMessage =
    String(row.update_message ?? "").trim() || "A newer version of Masjid E Mamoor 2 is available.";
  const policyUpdatedAt = String(row.policy_updated_at ?? "");

  if (
    (platform !== "android" && platform !== "ios") ||
    !nativeVersionPattern.test(currentVersion) ||
    !nativeVersionPattern.test(latestVersion) ||
    !nativeVersionPattern.test(minimumSupportedVersion) ||
    (updateStatus !== "none" && updateStatus !== "optional" && updateStatus !== "required") ||
    !updateMessage ||
    !policyUpdatedAt
  ) {
    throw new Error("invalid_release_status");
  }

  return {
    platform,
    currentVersion,
    latestVersion,
    minimumSupportedVersion,
    updateStatus,
    storeUrl: row.store_url == null ? null : String(row.store_url),
    updateMessage,
    policyUpdatedAt,
  };
}
