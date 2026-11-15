import { createBrowserClient } from '@supabase/ssr';

let browserClient;
export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase connection is not configured');
  browserClient ??= createBrowserClient(url, key);
  return browserClient;
}
