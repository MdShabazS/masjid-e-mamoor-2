#!/usr/bin/env python3
"""Create the first System Admin on the linked Supabase project.

The app never lets anyone create the first administrator from a screen. Run this
once per environment from `backend/` after `supabase link`:

    python3 scripts/bootstrap_system_admin.py <username> <password-file> [--local]

Add --local to use the local development stack (`supabase start`) instead.

It refuses if any System Admin already exists. The temporary password is
written only to <password-file> (mode 600) and never printed. The person must
change it at first sign-in. Delete the file after that.
"""

import os
import re
import secrets
import subprocess
import sys
import tempfile
import uuid

READABLE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # Same alphabet as backend/identity/service.js.
USERNAME = re.compile(r"^[a-z][a-z0-9._-]{2,31}$")
INTERNAL_DOMAIN = os.environ.get("IDENTITY_INTERNAL_DOMAIN", "accounts.masjid.invalid")


def temporary_password() -> str:
    return "-".join("".join(secrets.choice(READABLE) for _ in range(4)) for _ in range(4))


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--local"]
    target = "--local" if "--local" in sys.argv[1:] else "--linked"
    if len(args) != 2:
        print(__doc__.strip())
        return 2
    username = args[0].strip().lower()
    out_path = os.path.abspath(args[1])
    if not USERNAME.match(username):
        print("Username: 3-32 letters, numbers, dot, dash or underscore, starting with a letter.")
        return 2
    if os.path.exists(out_path):
        print(f"Refusing to overwrite {out_path}")
        return 2

    password = temporary_password()
    # Save the password first: an account whose only password was lost would need a manual repair.
    old_umask = os.umask(0o077)
    try:
        with open(out_path, "x") as handle:
            handle.write(
                f"Username: {username}\nTemporary password: {password}\n"
                "Sign in once and set your own password, then delete this file.\n"
            )
    except OSError as error:
        print(f"Cannot write {out_path}: {error.strerror}. Nothing was created.")
        return 2
    finally:
        os.umask(old_umask)
    user_id = str(uuid.uuid4())
    email = f"{username}@{INTERNAL_DOMAIN}"
    # One statement, so it is all-or-nothing on both the linked and the local query paths.
    sql = f"""
do $bootstrap$ begin
  if exists (select 1 from public.app_users where role = 'system_admin') then
    raise exception 'system_admin_already_exists';
  end if;
  if exists (select 1 from app_private.username_aliases where username = {sql_text(username)})
     or exists (select 1 from auth.users where email = {sql_text(email)}) then
    raise exception 'username_taken';
  end if;
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values (
    {sql_text(user_id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    {sql_text(email)}, extensions.crypt({sql_text(password)}, extensions.gen_salt('bf')), now(),
    '{{"provider":"email","providers":["email"]}}', '{{}}', now(), now(),
    '', '', '', '', '', '', '', '');
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (
    gen_random_uuid(), {sql_text(user_id)}, {sql_text(user_id)},
    jsonb_build_object('sub', {sql_text(user_id)}, 'email', {sql_text(email)}, 'email_verified', true),
    'email', now(), now());
  insert into public.app_users (id, role) values ({sql_text(user_id)}, 'system_admin');
  insert into app_private.username_aliases (user_id, username, must_change_password)
  values ({sql_text(user_id)}, {sql_text(username)}, true);
  insert into app_private.identity_audit (actor_id, target_id, event, new_role)
  values ({sql_text(user_id)}, {sql_text(user_id)}, 'provisioned', 'system_admin');
end $bootstrap$;
"""
    fd, sql_path = tempfile.mkstemp(suffix=".sql")
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write(sql)
        os.chmod(sql_path, 0o600)
        result = subprocess.run(
            ["supabase", "db", "query", target, "-f", sql_path],
            capture_output=True,
            text=True,
            check=False,
        )
    finally:
        os.remove(sql_path)

    output = result.stdout + result.stderr
    if result.returncode == 0:
        check = subprocess.run(
            ["supabase", "db", "query", target,
             f"select count(*) as system_admins from public.app_users where role = 'system_admin' and id = {sql_text(user_id)}"],
            capture_output=True, text=True, check=False,
        )
        output += check.stdout + check.stderr
    if result.returncode != 0 or '"system_admins": 1' not in output:
        for code in ("system_admin_already_exists", "username_taken"):
            if code in output:
                os.remove(out_path)
                print(f"Not created: {code}")
                return 1
        reason = next((line.strip() for line in output.splitlines() if "ERROR" in line or '"message"' in line), "")
        os.remove(out_path)
        print("Not created. The database rejected the request; nothing was saved.")
        if reason:
            print(reason.replace(password, "<hidden>")[:400])
        return 1

    print(f"Created System Admin {username}. Temporary password saved to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
