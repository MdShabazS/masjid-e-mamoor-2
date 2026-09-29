export function getMobileConfig() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const apiUrl = process.env.EXPO_PUBLIC_APP_API_URL;

  if (!supabaseUrl || !publishableKey || !apiUrl) {
    throw new Error("Missing mobile public environment configuration");
  }

  return { supabaseUrl, publishableKey, apiUrl };
}
