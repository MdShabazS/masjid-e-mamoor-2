import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const webApi = process.env.EXPO_PUBLIC_WEB_API_URL;
let client;

export function getNativeClient() {
  if (!url || !key || !webApi) throw new Error('Supabase connection is not configured');
  if (!client) {
    client = createClient(url, key, {
      auth: {
        storage: {
          getItem: (name) => SecureStore.getItemAsync(name),
          setItem: (name, value) => SecureStore.setItemAsync(name, value),
          removeItem: (name) => SecureStore.deleteItemAsync(name),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // Timers do not run reliably in the background, so a session can expire
    // while the app is away unless refresh follows the foreground state.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  return client;
}

/** Offline, a global sign-out fails and keeps the session; always clear this device. */
export async function signOutDevice(nativeClient) {
  const { error } = await nativeClient.auth.signOut();
  if (error) await nativeClient.auth.signOut({ scope: 'local' });
}
