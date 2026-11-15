// Server-only wiring. Pass createClient from @supabase/supabase-js at startup.
// SUPABASE_SECRET_KEY must never appear in an EXPO_PUBLIC/NEXT_PUBLIC variable.
export function supabaseIdentityAdapters({ createClient, url, publishableKey, secretKey }) {
  let endpoint;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error('Identity backend requires a valid Supabase URL');
  }
  if (
    !publishableKey ||
    !secretKey ||
    !(
      endpoint.protocol === 'https:' ||
      (endpoint.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(endpoint.hostname))
    )
  )
    throw new Error('Identity backend requires HTTPS Supabase URL and server keys');
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const service = createClient(url, secretKey, options);
  return {
    authAdmin: {
      createUser: (input) => service.auth.admin.createUser(input),
      deleteUser: (id) => service.auth.admin.deleteUser(id),
      updateUserById: (id, input) => service.auth.admin.updateUserById(id, input),
      signOut: (token, scope) => service.auth.admin.signOut(token, scope),
      rpc: (name, args) => service.rpc(name, args),
    },
    publicAuth: () => createClient(url, publishableKey, options).auth,
    clientForToken: (token) =>
      createClient(url, publishableKey, {
        ...options,
        global: { headers: { Authorization: `Bearer ${token}` } },
      }),
  };
}
