import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const username = process.env.BOOTSTRAP_SYSTEM_ADMIN_USERNAME;
const password = process.env.BOOTSTRAP_SYSTEM_ADMIN_PASSWORD;

const usernamePattern = /^[a-z0-9._-]{3,40}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!url || !serviceRoleKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!username || !usernamePattern.test(username.trim().toLowerCase())) {
  fail("Missing or invalid BOOTSTRAP_SYSTEM_ADMIN_USERNAME.");
}

if (!password || !passwordPattern.test(password)) {
  fail("Missing or weak BOOTSTRAP_SYSTEM_ADMIN_PASSWORD.");
}

const usernameNormalized = username.trim().toLowerCase();
const authLoginEmail = `${usernameNormalized}@auth.masjid.local`;
const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: existingAccount, error: existingAccountError } = await supabase
  .from("application_users")
  .select("id, auth_user_id")
  .eq("username_normalized", usernameNormalized)
  .maybeSingle();

if (existingAccountError) throw existingAccountError;

let authUserId = existingAccount?.auth_user_id;

if (!authUserId) {
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: authLoginEmail,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    throw createError ?? new Error("System Admin auth user was not created.");
  }

  authUserId = created.user.id;
} else {
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    authUserId,
    { password },
  );

  if (updateError) throw updateError;
}

const { data: account, error: accountError } = await supabase
  .from("application_users")
  .upsert(
    {
      auth_user_id: authUserId,
      auth_login_email: authLoginEmail,
      username: username.trim(),
      username_normalized: usernameNormalized,
      status: "active",
      must_change_password: true,
      credential_updated_at: new Date().toISOString(),
    },
    { onConflict: "auth_user_id" },
  )
  .select("id")
  .single();

if (accountError || !account) {
  throw accountError ?? new Error("System Admin application user missing.");
}

const { data: role, error: roleError } = await supabase
  .from("roles")
  .select("id")
  .eq("key", "system_admin")
  .single();

if (roleError || !role) {
  throw roleError ?? new Error("system_admin role is missing.");
}

const { error: deleteRoleError } = await supabase
  .from("application_user_roles")
  .delete()
  .eq("application_user_id", account.id);

if (deleteRoleError) throw deleteRoleError;

const { error: insertRoleError } = await supabase
  .from("application_user_roles")
  .insert({
    application_user_id: account.id,
    role_id: role.id,
  });

if (insertRoleError) throw insertRoleError;

await supabase.from("account_security_events").insert({
  actor_application_user_id: account.id,
  target_application_user_id: account.id,
  event_type: "system_admin.bootstrapped",
  metadata: { username: usernameNormalized },
});

console.log("System Admin bootstrap completed.");
