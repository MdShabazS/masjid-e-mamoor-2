#!/usr/bin/env python3
"""Exercise Phase 4 RPCs with two issued local Supabase Auth sessions."""

import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_masjid-e-mamoor-2-fresh"
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"]


def sql(query):
    result = subprocess.run(PSQL, input=query, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def request(base, method, path, api_key, token, body=None):
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        base + path,
        data=payload,
        method=method,
        headers={"apikey": api_key, "Authorization": "Bearer " + token,
                 "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    return status, json.loads(raw) if raw else None


def expect(base, command, key, token, body, status=200):
    actual, data = request(base, "POST", "/rest/v1/rpc/" + command, key, token, body)
    if actual != status:
        raise AssertionError(f"{command}: expected HTTP {status}, got {actual}, code {data.get('code') if isinstance(data, dict) else None}")
    if status == 403 and (not isinstance(data, dict) or data.get("code") != "42501"):
        raise AssertionError(f"{command}: wrong denial code")
    return data


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable for the fresh local stack")
    if sql("select (select count(*) from auth.users),(select count(*) from public.finance_effects)") != "0|0":
        raise SystemExit("Fresh local database must be empty before this test")
    status = subprocess.run(["supabase", "status", "-o", "json"], cwd=BACKEND,
                            text=True, capture_output=True, check=True)
    config = json.loads(status.stdout)
    base, anon, admin = config["API_URL"], config["ANON_KEY"], config["SERVICE_ROLE_KEY"]
    users = []
    try:
        for role in ("president", "treasurer"):
            email = f"phase4-{role}-{secrets.token_hex(5)}@example.com"
            password = secrets.token_urlsafe(30)
            code, created = request(base, "POST", "/auth/v1/admin/users", admin, admin,
                                    {"email": email, "password": password, "email_confirm": True})
            if code != 200 or not created.get("id"):
                raise AssertionError(f"Auth Admin create {role}: HTTP {code}")
            user_id = str(uuid.UUID(created["id"]))
            sql(f"""
insert into public.app_users(id,role) values ('{user_id}','{role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{user_id}','phase4{role}{secrets.token_hex(3)}',false);
""")
            code, signed_in = request(base, "POST", "/auth/v1/token?grant_type=password",
                                      anon, anon, {"email": email, "password": password})
            if code != 200 or not signed_in.get("access_token"):
                raise AssertionError(f"issued {role} session: HTTP {code}")
            users.append((role, signed_in["access_token"]))
        tokens = dict(users)
        print("two Auth Admin users signed in with distinct issued role sessions")

        account_ids = []
        for name in ("API cash", "API second cash"):
            account_ids.append(expect(base, "create_finance_account", anon, tokens["president"], {
                "p_name": name, "p_kind": "cash", "p_upi_id": None,
                "p_bank_account_number": None, "p_ifsc": None,
                "p_operation_id": str(uuid.uuid4()),
            }))
        source, target = account_ids
        expect(base, "post_finance_transfer", anon, tokens["president"], {
            "p_from_account_id": source, "p_to_account_id": target,
            "p_amount_paise": 1, "p_evidence_reference": "synthetic proof",
            "p_operation_id": str(uuid.uuid4()),
        }, 403)
        openings = []
        for account_id, amount in ((source, 10000), (target, 0)):
            openings.append(expect(base, "submit_account_opening", anon, tokens["treasurer"], {
                "p_account_id": account_id, "p_amount_paise": amount,
                "p_evidence_reference": "synthetic count",
                "p_operation_id": str(uuid.uuid4()),
            }))
        expect(base, "verify_account_opening", anon, tokens["treasurer"], {
            "p_opening_id": openings[0], "p_operation_id": str(uuid.uuid4()),
        }, 403)
        before = expect(base, "list_finance_accounts", anon, tokens["treasurer"], {})
        if {item["account_id"]: item["balance_paise"] for item in before} != {source: "0", target: "0"}:
            raise AssertionError("pending openings changed balances")
        for opening in openings:
            expect(base, "verify_account_opening", anon, tokens["president"], {
                "p_opening_id": opening, "p_operation_id": str(uuid.uuid4()),
            })
        expect(base, "post_finance_transfer", anon, tokens["treasurer"], {
            "p_from_account_id": source, "p_to_account_id": target,
            "p_amount_paise": 3000, "p_evidence_reference": "synthetic proof",
            "p_operation_id": str(uuid.uuid4()),
        })
        after = expect(base, "list_finance_accounts", anon, tokens["president"], {})
        if {item["account_id"]: item["balance_paise"] for item in after} != {source: "7000", target: "3000"}:
            raise AssertionError("posted balances do not reconcile")
        direct, direct_body = request(base, "GET", "/rest/v1/app_users?select=id", anon,
                            tokens["treasurer"])
        if direct != 403 or not isinstance(direct_body, dict) or direct_body.get("code") != "42501":
            raise AssertionError(f"direct app_users access: HTTP {direct}")
        print("role denials, pending opening, verification, transfer, balances and direct table denial passed")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, text=True, capture_output=True, check=False)
        if reset.returncode:
            print(reset.stderr.strip(), file=sys.stderr)
            raise RuntimeError("local cleanup reset failed")
        print("fresh local database reset completed after issued-session test")


if __name__ == "__main__":
    main()
