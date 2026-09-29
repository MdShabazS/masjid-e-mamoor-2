import "react-native-url-polyfill/auto";

import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { getMobileConfig } from "./config";

const SECURE_STORE_CHUNK_SIZE = 1800;

const secureStore = {
  async getItem(key: string) {
    const countValue = await SecureStore.getItemAsync(`${key}:count`);
    if (!countValue) return null;

    const count = Number(countValue);
    if (!Number.isInteger(count) || count < 1) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${key}:${index}`),
      ),
    );

    return chunks.every((chunk) => chunk != null) ? chunks.join("") : null;
  },
  async setItem(key: string, value: string) {
    const previousCount = Number(
      (await SecureStore.getItemAsync(`${key}:count`)) ?? "0",
    );
    const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, "g")) ?? [""];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}:${index}`, chunk),
      ),
    );
    await SecureStore.setItemAsync(`${key}:count`, String(chunks.length));

    if (Number.isInteger(previousCount) && previousCount > chunks.length) {
      await Promise.all(
        Array.from({ length: previousCount - chunks.length }, (_, offset) =>
          SecureStore.deleteItemAsync(`${key}:${chunks.length + offset}`),
        ),
      );
    }
  },
  async removeItem(key: string) {
    const count = Number((await SecureStore.getItemAsync(`${key}:count`)) ?? "0");
    await Promise.all([
      SecureStore.deleteItemAsync(`${key}:count`),
      ...(Number.isInteger(count) && count > 0
        ? Array.from({ length: count }, (_, index) =>
            SecureStore.deleteItemAsync(`${key}:${index}`),
          )
        : []),
    ]);
  },
};

const { supabaseUrl, publishableKey } = getMobileConfig();

export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    storage: secureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let foregroundListenerRegistered = false;

export function registerAuthRefreshListener() {
  if (foregroundListenerRegistered) return;
  foregroundListenerRegistered = true;

  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
