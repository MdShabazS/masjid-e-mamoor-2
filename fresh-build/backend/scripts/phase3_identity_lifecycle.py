#!/usr/bin/env python3
"""Exercise real username, first-password, reset and deactivation paths locally.

Runs only against the isolated disposable fresh Supabase stack and resets it
afterward. No synthetic credentials are printed or retained.
"""

import base64
import json
import os
import secrets
import subprocess
import sys
import time
import uuid
from pathlib import Path

from phase4_auth_api import request, sql


BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
PORT = 18086


def expect(base, path, body, status, token=None):
    code, response = request(base, "POST", path, "", token or "test", body)
    if code != status:
        error = response.get("error", {}).get("code") if isinstance(response, dict) else None
        raise AssertionError(f"{path}: expected {status}, got {code} ({error})")
    return response


def gated_role(api, key, token, expected):
    code, role = request(api, "POST", "/rest/v1/rpc/current_app_role", key, token, {})
    if code != 200 or role != expected:
        raise AssertionError(f"current_app_role: expected {expected}, got {code}/{role}")


def session_exists(token):
    encoded = token.split(".")[1]
    payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
    session_id = str(uuid.UUID(payload["session_id"]))
    return sql(f"select exists(select 1 from auth.sessions where id='{session_id}')") == "t"


def wait_for_server(base, process):
    for _ in range(80):
        if process.poll() is not None:
            raise RuntimeError("local web server exited before readiness")
        try:
            code, _ = request(base, "GET", "/api/v1/me", "", "test")
            if code == 401:
                return
        except OSError:
            pass
        time.sleep(0.25)
    raise RuntimeError("local web server did not become ready")


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable")
    if sql("select (select count(*) from auth.users),(select count(*) from public.app_users)") != "0|0":
        raise SystemExit("The isolated fresh local database must be empty")
    result = subprocess.run(["supabase", "status", "-o", "json"], cwd=BACKEND,
                            capture_output=True, text=True, check=True)
    config = json.loads(result.stdout)
    api, anon, service = config["API_URL"], config["ANON_KEY"], config["SERVICE_ROLE_KEY"]
    if not api.startswith("http://127.0.0.1:55321"):
        raise SystemExit("Refusing an unexpected Supabase API target")
    env = os.environ.copy()
    env.update({
        "NEXT_PUBLIC_SUPABASE_URL": api,
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": anon,
        "SUPABASE_URL": api,
        "SUPABASE_PUBLISHABLE_KEY": anon,
        "SUPABASE_SERVICE_ROLE_KEY": service,
        "IDENTITY_INTERNAL_DOMAIN": "accounts.masjid.invalid",
    })
    base = f"http://localhost:{PORT}"
    log = open("/private/tmp/masjid-phase3-identity-server.log", "w", encoding="utf-8")
    server = None
    try:
        server = subprocess.Popen(
            ["npm", "run", "dev", "--workspace=@masjid/fresh-web", "--", "-p", str(PORT)],
            cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT,
        )
        wait_for_server(base, server)

        suffix = secrets.token_hex(5)
        admin_name = f"identityadmin{suffix}"
        admin_password = secrets.token_urlsafe(30)
        admin_email = f"{admin_name}@accounts.masjid.invalid"
        code, created = request(api, "POST", "/auth/v1/admin/users", service, service,
                                {"email": admin_email, "password": admin_password,
                                 "email_confirm": True})
        if code != 200 or not isinstance(created, dict) or not created.get("id"):
            raise AssertionError(f"seed Auth Admin create: HTTP {code}")
        admin_id = str(uuid.UUID(created["id"]))
        sql(f"""
insert into public.app_users(id,role) values ('{admin_id}','system_admin');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{admin_id}','{admin_name}',false);
""")
        admin_signin = expect(base, "/api/v1/session",
                              {"username": admin_name, "password": admin_password}, 200)
        admin_token = admin_signin["data"]["session"]["access_token"]
        if admin_signin["data"]["mustChangePassword"]:
            raise AssertionError("seed admin unexpectedly gated")

        member_name = f"identitymember{suffix}"
        provision = expect(base, "/api/v1/users", {"username": member_name, "role": "member"},
                           201, admin_token)["data"]
        member_id = str(uuid.UUID(provision["userId"]))
        first_password = provision["temporaryPassword"]
        first = expect(base, "/api/v1/session",
                       {"username": member_name, "password": first_password}, 200)["data"]
        if not first["mustChangePassword"]:
            raise AssertionError("new member did not require password change")
        first_token = first["session"]["access_token"]
        first_refresh = first["session"]["refresh_token"]
        gated_role(api, anon, first_token, None)
        code, _ = request(api, "POST", "/rest/v1/rpc/list_monthly_donors", anon,
                          first_token, {})
        if code != 403:
            raise AssertionError(f"first-password gate allowed roster: {code}")
        chosen_password = secrets.token_urlsafe(30)
        expect(base, "/api/v1/session/change-password",
               {"refreshToken": first_refresh, "newPassword": chosen_password}, 200,
               first_token)
        signed = expect(base, "/api/v1/session",
                        {"username": member_name, "password": chosen_password}, 200)["data"]
        if signed["mustChangePassword"]:
            raise AssertionError("first password change did not clear gate")
        member_token = signed["session"]["access_token"]
        gated_role(api, anon, member_token, "member")
        gated_role(api, anon, first_token, None)
        print("provision, first-password gate, change and fresh login passed")

        reset = expect(base, f"/api/v1/users/{member_id}/reset", {}, 200,
                       admin_token)["data"]
        reset_password = reset["temporaryPassword"]
        if session_exists(member_token):
            raise AssertionError("reset did not revoke the old Auth session")
        gated_role(api, anon, member_token, None)
        code, _ = request(api, "POST", "/rest/v1/rpc/list_monthly_donors", anon,
                          member_token, {})
        if code != 403:
            raise AssertionError(f"reset gate allowed old issued session: {code}")
        stale_change = expect(base, "/api/v1/session/change-password",
                              {"refreshToken": signed["session"]["refresh_token"],
                               "newPassword": secrets.token_urlsafe(30)}, 401,
                              member_token)
        if stale_change.get("error", {}).get("code") != "AUTH_REQUIRED":
            raise AssertionError("stale pre-reset session had unexpected denial shape")
        old = expect(base, "/api/v1/session",
                     {"username": member_name, "password": chosen_password}, 401)
        if old.get("error", {}).get("code") != "INVALID_CREDENTIALS":
            raise AssertionError("old password had unexpected failure shape")
        temporary = expect(base, "/api/v1/session",
                           {"username": member_name, "password": reset_password}, 200)["data"]
        if not temporary["mustChangePassword"]:
            raise AssertionError("reset password did not require change")
        final_password = secrets.token_urlsafe(30)
        expect(base, "/api/v1/session/change-password",
               {"refreshToken": temporary["session"]["refresh_token"],
                "newPassword": final_password}, 200,
               temporary["session"]["access_token"])
        code, role = request(api, "POST", "/rest/v1/rpc/current_app_role", anon,
                             member_token, {})
        if code != 200 or role is not None:
            raise AssertionError("pre-reset session regained role after new password change")
        print("admin reset, old-password denial, reset gate and new password passed")

        expect(base, f"/api/v1/users/{member_id}/state",
               {"role": "member", "active": False}, 200, admin_token)
        me = expect(base, "/api/v1/session", {"username": member_name,
                    "password": final_password}, 403)
        if me.get("error", {}).get("code") != "ACCOUNT_INACTIVE":
            raise AssertionError("inactive login had unexpected failure shape")
        code, _ = request(api, "POST", "/rest/v1/rpc/list_monthly_donors", anon,
                          member_token, {})
        if code != 403:
            raise AssertionError(f"inactive issued session allowed roster: {code}")
        audit = sql(f"select string_agg(event,',' order by occurred_at,id) from "
                    f"app_private.identity_audit where target_id='{member_id}'")
        for event in ("provisioned", "password_changed", "password_reset_required",
                      "deactivated"):
            if event not in audit:
                raise AssertionError(f"missing identity audit event: {event}")
        print("deactivation and identity audit passed")

        limited_name = f"unknown{suffix}"
        statuses = [expect(base, "/api/v1/session",
                           {"username": limited_name, "password": "invalid"},
                           401 if attempt < 5 else 429).get("error", {}).get("code")
                    for attempt in range(6)]
        if statuses[-1] != "RATE_LIMITED":
            raise AssertionError("shared login limiter did not enforce five attempts")
        print("shared login rate limiter denied attempt six")
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=8)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait(timeout=8)
        log.close()
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, capture_output=True, text=True)
        if reset.returncode:
            print(reset.stderr.strip(), file=sys.stderr)
            raise RuntimeError("isolated local cleanup reset failed")
        print("disposable local identity rows removed by reset")


if __name__ == "__main__":
    main()
