import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.LOCAL_AUTH_V2_TEST_PASSWORD;

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;

const fixtures = [
  ["919900000001", "member.test"],
  ["919900000002", "finance.test"],
  ["919900000003", "president.test"],
  ["919900000004", "auditor.test"],
  ["919900000005", "vicepresident.test"],
  ["919900000006", "secretary.test"],
  ["919900000007", "committee.test"],
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!url || !serviceRoleKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!password || !passwordPattern.test(password)) {
  fail("Missing or weak LOCAL_AUTH_V2_TEST_PASSWORD.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: listed, error: listError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

if (listError) throw listError;

const authUsersByPhone = new Map(
  (listed.users ?? [])
    .filter((user) => user.phone)
    .map((user) => [String(user.phone).replace(/^\+/, ""), user]),
);

for (const [phone, username] of fixtures) {
  const authUser = authUsersByPhone.get(phone);

  if (!authUser) {
    console.log(`Skipped ${username}: auth phone fixture not found.`);
    continue;
  }

  const authLoginEmail = `${username}@auth.masjid.local`;
  const { error: authError } = await supabase.auth.admin.updateUserById(
    authUser.id,
    {
      email: authLoginEmail,
      password,
      email_confirm: true,
    },
  );

  if (authError) throw authError;

  const { error: appUserError } = await supabase
    .from("application_users")
    .update({
      auth_login_email: authLoginEmail,
      username,
      username_normalized: username,
      must_change_password: true,
      credential_updated_at: new Date().toISOString(),
    })
    .eq("auth_user_id", authUser.id);

  if (appUserError) throw appUserError;

  console.log(`Provisioned ${username}.`);
}

console.log("Local Auth V2 fixture provisioning completed.");
