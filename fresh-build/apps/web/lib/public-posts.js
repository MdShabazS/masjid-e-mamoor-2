import { createClient } from '@supabase/supabase-js';

export async function getPublicPosts(limit = 6) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { posts: [], unavailable: true };
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.rpc('list_published_community_posts', { p_limit: limit });
  if (error) return { posts: [], unavailable: true };
  return { posts: data ?? [], unavailable: false };
}
