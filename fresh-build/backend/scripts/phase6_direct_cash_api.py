#!/usr/bin/env python3
"""Issued-session direct cash posting check on the disposable local stack."""

import json
import os
import secrets
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

from phase4_auth_api import BACKEND, expect, request, sql


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable")
    if sql("select (select count(*) from auth.users),(select count(*) from public.finance_effects)") != "0|0":
        raise SystemExit("Fresh local database must be empty")
    status = subprocess.run(["supabase", "status", "-o", "json"], cwd=BACKEND,
                            text=True, capture_output=True, check=True)
    config = json.loads(status.stdout)
    base, anon, admin = config["API_URL"], config["ANON_KEY"], config["SERVICE_ROLE_KEY"]
    tokens = {}
    try:
        for role in ("president", "treasurer", "member"):
            email = f"phase6cash-{role}-{secrets.token_hex(5)}@fixture.invalid"
            password = secrets.token_urlsafe(30)
            code, created = request(base, "POST", "/auth/v1/admin/users", admin, admin,
                                    {"email": email, "password": password, "email_confirm": True})
            if code != 200 or not created.get("id"):
                raise AssertionError(f"Auth create {role}: HTTP {code}")
            user_id = str(uuid.UUID(created["id"]))
            sql(f"""insert into public.app_users(id,role) values ('{user_id}','{role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{user_id}','phase6cash{role}{secrets.token_hex(3)}',false);""")
            code, signed_in = request(base, "POST", "/auth/v1/token?grant_type=password",
                                      anon, anon, {"email": email, "password": password})
            if code != 200 or not signed_in.get("access_token"):
                raise AssertionError(f"Auth sign in {role}: HTTP {code}")
            tokens[role] = signed_in["access_token"]

        account = expect(base, "create_finance_account", anon, tokens["president"], {
            "p_name": "Synthetic direct cash", "p_kind": "cash", "p_upi_id": None,
            "p_bank_account_number": None, "p_ifsc": None,
            "p_operation_id": str(uuid.uuid4()),
        })
        opening = expect(base, "submit_account_opening", anon, tokens["treasurer"], {
            "p_account_id": account, "p_amount_paise": 10000,
            "p_evidence_reference": "Synthetic counted opening",
            "p_operation_id": str(uuid.uuid4()),
        })
        expect(base, "verify_account_opening", anon, tokens["president"], {
            "p_opening_id": opening, "p_operation_id": str(uuid.uuid4()),
        })
        args = {
            "p_name": "Synthetic named cash donor", "p_kind": "other",
            "p_referrer_id": None, "p_date": datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat(),
            "p_amount_paise": 1234, "p_evidence": "Numbered synthetic cash slip",
            "p_account_id": account, "p_operation_id": str(uuid.uuid4()),
        }
        for role in ("president", "member"):
            expect(base, "post_direct_treasurer_cash", anon, tokens[role], args, 403)
        donation = expect(base, "post_direct_treasurer_cash", anon, tokens["treasurer"], args)
        if expect(base, "post_direct_treasurer_cash", anon, tokens["treasurer"], args) != donation:
            raise AssertionError("direct post replay changed donation ID")
        status_code, conflict = request(base, "POST", "/rest/v1/rpc/post_direct_treasurer_cash",
                                        anon, tokens["treasurer"], {**args, "p_amount_paise": 1235})
        if status_code != 409 or conflict.get("code") != "23505":
            raise AssertionError("changed direct post replay was accepted")
        status_code, conflict = request(base, "POST", "/rest/v1/rpc/post_direct_treasurer_cash",
                                        anon, tokens["treasurer"], {
                                            **args, "p_evidence": " NUMBERED SYNTHETIC CASH SLIP ",
                                            "p_operation_id": str(uuid.uuid4()),
                                        })
        if status_code != 409 or conflict.get("code") != "23505":
            raise AssertionError("same cash slip posted under a different operation ID")
        if sql(f"""select count(*), coalesce(sum(amount_paise),0) from public.finance_effects
where source_type='one_time_donation' and source_id='{donation}'""") != "1|1234":
            raise AssertionError("direct post did not create exactly one income effect")
        if sql(f"""select status,actual_amount_paise,receipt_code is not null from public.one_time_donations
where id='{donation}'""") != "verified|1234|t":
            raise AssertionError("verified donation or receipt missing")
        if sql(f"select count(*) from public.direct_cash_posts where donation_id='{donation}'") != "1":
            raise AssertionError("direct post audit link missing")
        if sql(f"select coalesce(sum(amount_paise),0) from public.finance_effects where account_id='{account}'") != "11234":
            raise AssertionError("cash balance changed by more than the verified amount")
        concurrent = {**args, "p_evidence": "Concurrent synthetic slip",
                      "p_amount_paise": 200, "p_operation_id": str(uuid.uuid4())}
        def post(body):
            return request(base, "POST", "/rest/v1/rpc/post_direct_treasurer_cash",
                           anon, tokens["treasurer"], body)
        with ThreadPoolExecutor(max_workers=2) as executor:
            same_operation = list(executor.map(post, [concurrent, concurrent]))
        if any(code != 200 for code, _ in same_operation) or same_operation[0][1] != same_operation[1][1]:
            raise AssertionError("concurrent exact retries did not reuse one donation")
        competing = [{**concurrent, "p_evidence": "Another numbered cash slip",
                      "p_operation_id": str(uuid.uuid4())} for _ in range(2)]
        with ThreadPoolExecutor(max_workers=2) as executor:
            same_slip = list(executor.map(post, competing))
        if sorted(code for code, _ in same_slip) != [200, 409] or not any(
                code == 409 and body.get("code") == "23505" for code, body in same_slip):
            raise AssertionError("concurrent distinct operations posted the same slip twice")
        if sql(f"select coalesce(sum(amount_paise),0) from public.finance_effects where account_id='{account}'") != "11634":
            raise AssertionError("concurrent retries or duplicate slips changed balance")
        if sql("select count(*) from public.direct_cash_posts") != "3":
            raise AssertionError("concurrent direct post count mismatch")
        print("issued role denials, exact replay, one effect, same-operation race and duplicate-slip race passed")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, text=True, capture_output=True, check=False)
        if reset.returncode:
            raise RuntimeError(f"disposable reset failed: {reset.stderr.strip()}")
        print("fresh local database reset completed after direct cash API test")


if __name__ == "__main__":
    main()
