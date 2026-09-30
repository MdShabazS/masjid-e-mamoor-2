import "react-native-url-polyfill/auto";

import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { getMobileConfig } from "./config";
import { secureStore } from "./secure-store";

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
