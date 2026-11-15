import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { secureStore } from "../lib/secure-store";
import { supabase } from "../lib/supabase";

const INSTALLATION_ID_KEY = "notification.installation-id";

export type PushPlatform = "android" | "ios";

export function resolvePushPlatform(platform = Platform.OS): PushPlatform | null {
  return platform === "android" || platform === "ios" ? platform : null;
}

export function getEasProjectId() {
  const value = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getPushInstallationId() {
  const existing = await secureStore.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const id = Crypto.randomUUID();
  await secureStore.setItem(INSTALLATION_ID_KEY, id);
  return id;
}

export async function registerCurrentPushDevice(platformValue = Platform.OS) {
  const platform = resolvePushPlatform(platformValue);
  const projectId = getEasProjectId();
  if (!platform || !projectId) return false;

  if (platform === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Masjid E Mamoor 2 updates",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: "#B49A5A",
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status === "undetermined") {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== "granted") return false;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const deviceId = await getPushInstallationId();
  const { error } = await supabase.rpc("register_my_notification_push_device", {
    p_device_id: deviceId,
    p_platform: platform,
    p_expo_push_token: token.data,
  });
  if (error) throw new Error("push_device_registration_failed");
  return true;
}

export async function unregisterCurrentPushDevice() {
  const deviceId = await secureStore.getItem(INSTALLATION_ID_KEY);
  if (!deviceId) return;

  const { error } = await supabase.rpc("unregister_my_notification_push_device", {
    p_device_id: deviceId,
  });
  if (error) throw new Error("push_device_unregistration_failed");
}
