#!/usr/bin/env python3
"""Check eight distinct issued Auth sessions on the disposable fresh stack."""

import base64
import concurrent.futures
import hashlib
import hmac
import json
import os
import secrets
import subprocess
import sys
import time
import uuid
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from phase4_auth_api import request, sql


BACKEND = Path(__file__).resolve().parents[1]
RPC_MATRIX = BACKEND / "tests" / "hosted_rpc_role_matrix.json"
ROLES = (
    "system_admin", "president", "vice_president", "secretary",
    "treasurer", "committee_member", "member", "data_entry",
)
READ_ONLY_RPCS = {
    "active_payment_qr_for_staff", "finance_receipt_state", "get_monthly_donor_contact",
    "list_account_beneficiary_versions", "list_actionable_expenses",
    "list_active_masjid_accounts", "list_correctable_finance_effects",
    "list_finance_account_history", "list_finance_accounts",
    "list_finance_reconciliations", "list_finance_report_balances",
    "list_finance_report_lines", "list_hafiz_prayer_marks",
    "list_managed_community_posts", "list_member_community_posts",
    "list_monthly_donors", "list_my_member_inbox", "list_pending_finance_openings",
    "list_pending_monthly_claims", "list_pending_one_time_donations",
    "list_visible_committee_meetings", "list_visible_work_tasks",
    "list_work_task_participants", "my_verified_task_count",
    "payment_qr_account_eligible",
}
READ_ARGUMENTS = {
    "p_account_id": "11111111-1111-4111-8111-111111111111",
    "p_before_at": None,
    "p_before_id": None,
    "p_code": "SYNTHETIC-UNKNOWN",
    "p_donor_id": "22222222-2222-4222-8222-222222222222",
    "p_end_exclusive": "2026-10-02",
    "p_limit": 10,
    "p_run_id": "33333333-3333-4333-8333-333333333333",
    "p_start": "2026-10-01",
    "p_task_id": "44444444-4444-4444-8444-444444444444",
}


def rpc(base, key, token, name, arguments=None):
    return request(base, "POST", "/rest/v1/rpc/" + name, key, token, arguments or {})


def assert_response(base, key, token, name, allowed, arguments=None):
    status, body = rpc(base, key, token, name, arguments)
    if allowed:
        if status != 200:
            raise AssertionError(f"{name}: expected 200, got {status}")
    elif status != 403 or not isinstance(body, dict) or body.get("code") != "42501":
        raise AssertionError(f"{name}: expected 403/42501, got {status}")
    return body


def expired_local_token(secret, actor_id):
    def encode(value):
        raw = json.dumps(value, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    header = encode({"alg": "HS256", "typ": "JWT"})
    payload = encode({"sub": actor_id, "role": "authenticated", "aud": "authenticated",
                      "iss": "supabase-demo", "iat": 1, "exp": int(time.time()) - 60})
    signing_input = f"{header}.{payload}"
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(),
        signing_input.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{signing_input}.{signature}"


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable for the fresh local stack")
    if sql("select (select count(*) from auth.users),(select count(*) from public.finance_effects)") != "0|0":
        raise SystemExit("Fresh local database must have zero Auth users and effects")
    sql("notify pgrst, 'reload schema'")
    status = subprocess.run(["supabase", "status", "-o", "json"], cwd=BACKEND,
                            text=True, capture_output=True, check=True)
    config = json.loads(status.stdout)
    base, public_key, admin_key = config["API_URL"], config["ANON_KEY"], config["SERVICE_ROLE_KEY"]
    actors = {}
    try:
        for role in ROLES:
            email = f"phase3-{role}-{secrets.token_hex(5)}@example.invalid"
            password = secrets.token_urlsafe(30)
            code, created = request(base, "POST", "/auth/v1/admin/users", admin_key,
                                    admin_key, {"email": email, "password": password,
                                                "email_confirm": True})
            if code != 200 or not isinstance(created, dict) or not created.get("id"):
                raise AssertionError(f"Auth Admin create {role}: HTTP {code}")
            actor_id = str(uuid.UUID(created["id"]))
            sql(f"""
insert into public.app_users(id,role) values ('{actor_id}','{role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{actor_id}','fixture{role.replace('_', '')}{secrets.token_hex(3)}',false);
""")
            code, signed_in = request(base, "POST", "/auth/v1/token?grant_type=password",
                                      public_key, public_key,
                                      {"email": email, "password": password})
            if code != 200 or not isinstance(signed_in, dict) or not signed_in.get("access_token"):
                raise AssertionError(f"issued {role} session: HTTP {code}")
            actors[role] = (actor_id, signed_in["access_token"])

        checks = 0
        for index, role in enumerate(ROLES):
            _, token = actors[role]
            if assert_response(base, public_key, token, "current_app_role", True) != role:
                raise AssertionError(f"issued session projected wrong role: {role}")
            checks += 1
            assert_response(base, public_key, token, "list_monthly_donors", True)
            checks += 1
            assert_response(base, public_key, token, "list_finance_accounts", index < 5)
            checks += 1
            assert_response(base, public_key, token, "list_visible_work_tasks", index != 0)
            checks += 1
            assert_response(base, public_key, token, "list_hafiz_prayer_marks",
                            1 <= index <= 4,
                            {"p_start": "2026-10-01", "p_end_exclusive": "2026-10-02"})
            checks += 1
            direct, body = request(base, "GET", "/rest/v1/app_users?select=id",
                                   public_key, token)
            if direct != 403 or not isinstance(body, dict) or body.get("code") != "42501":
                raise AssertionError(f"direct app_users read leaked to {role}: HTTP {direct}")
            checks += 1
        print(f"{checks} role/read checks passed with eight distinct issued Auth sessions")

        matrix = json.loads(RPC_MATRIX.read_text())
        cases = matrix["cases"]
        if len(cases) != matrix["guarded_rpc_count"] or len({c["rpc"] for c in cases}) != len(cases):
            raise AssertionError("guarded RPC matrix count or uniqueness drift")
        read_cases = [case for case in cases if case["rpc"] in READ_ONLY_RPCS]
        if len(read_cases) != len(READ_ONLY_RPCS):
            raise AssertionError("read-only RPC inventory drift")
        _, president_token = actors["president"]
        status, account_id = rpc(base, public_key, president_token, "create_finance_account", {
            "p_name": "Permission matrix fixture", "p_kind": "cash", "p_upi_id": None,
            "p_bank_account_number": None, "p_ifsc": None,
            "p_operation_id": str(uuid.uuid4()),
        })
        if status != 200 or not isinstance(account_id, str):
            raise AssertionError(f"fixture account creation failed: HTTP {status}")
        _, treasurer_token = actors["treasurer"]
        status, opening_id = rpc(base, public_key, treasurer_token, "submit_account_opening", {
            "p_account_id": account_id, "p_amount_paise": 12345,
            "p_evidence_reference": "Synthetic report opening",
            "p_operation_id": str(uuid.uuid4()),
        })
        if status != 200 or not isinstance(opening_id, str):
            raise AssertionError(f"fixture opening submission failed: HTTP {status}")
        status, _ = rpc(base, public_key, president_token, "verify_account_opening", {
            "p_opening_id": opening_id, "p_operation_id": str(uuid.uuid4()),
        })
        if status != 200:
            raise AssertionError(f"fixture opening verification failed: HTTP {status}")
        today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
        period_start = date(today.year, today.month, 1)
        period_end = (date(today.year + 1, 1, 1) if today.month == 12
                      else date(today.year, today.month + 1, 1))
        report_runs = {}
        for requester_role in ("president", "vice_president", "secretary", "treasurer"):
            _, requester_token = actors[requester_role]
            report_status, run_id = rpc(base, public_key, requester_token, "request_finance_report", {
                "p_kind": "month", "p_start": period_start.isoformat(),
                "p_end_exclusive": period_end.isoformat(), "p_include_proofs": False,
                "p_operation_id": str(uuid.uuid4()),
            })
            if report_status != 200 or not isinstance(run_id, str):
                raise AssertionError(f"report request failed for {requester_role}: HTTP {report_status}")
            report_runs[requester_role] = run_id
        read_arguments = {**READ_ARGUMENTS, "p_account_id": account_id,
                          "p_run_id": report_runs["president"]}
        owned_tasks = {}
        for owner_role in ("president", "vice_president", "secretary"):
            _, owner_token = actors[owner_role]
            task_status, task_id = rpc(base, public_key, owner_token, "create_work_task", {
                "p_title": "Permission matrix task", "p_description": "Synthetic owner check",
                "p_date": "2026-10-19", "p_location": "Fixture room", "p_mode": "open",
                "p_total": 1, "p_invited": 0, "p_volunteer": 1,
                "p_operation_id": str(uuid.uuid4()),
            })
            if task_status != 200 or not isinstance(task_id, str):
                raise AssertionError(f"fixture task creation failed for {owner_role}: HTTP {task_status}")
            owned_tasks[owner_role] = task_id
        allowed_jobs = [(role, case) for case in read_cases for role in case["roles"]]
        for role, case in allowed_jobs:
            _, token = actors[role]
            arguments = {name: read_arguments[name] for name in case["args"]}
            if case["rpc"] == "list_work_task_participants":
                arguments["p_task_id"] = owned_tasks[role]
            status, body = rpc(base, public_key, token, case["rpc"], arguments)
            if status != 200:
                code = body.get("code") if isinstance(body, dict) else None
                raise AssertionError(f"allowed {role}/{case['rpc']}: HTTP {status}, code {code}")
            if case["rpc"] == "list_finance_report_lines":
                if not isinstance(body, list) or len(body) != 1 or body[0].get("source_type") != "account_opening" or body[0].get("amount_paise") != "12345":
                    raise AssertionError(f"wrong report line projection for {role}")
            if case["rpc"] == "list_finance_report_balances":
                if not isinstance(body, list) or len(body) != 1 or body[0].get("account_id") != account_id or body[0].get("period_openings_paise") != "12345" or body[0].get("closing_paise") != "12345":
                    raise AssertionError(f"wrong report balance projection for {role}")
        for requester_role, run_id in report_runs.items():
            _, requester_token = actors[requester_role]
            for name in ("list_finance_report_lines", "list_finance_report_balances"):
                result = assert_response(base, public_key, requester_token, name, True,
                                         {"p_run_id": run_id})
                if not isinstance(result, list) or len(result) != 1:
                    raise AssertionError(f"report snapshot missing for {requester_role}/{name}")
                row = result[0]
                expected = ({"source_type": "account_opening", "amount_paise": "12345"}
                            if name == "list_finance_report_lines" else
                            {"account_id": account_id, "period_openings_paise": "12345",
                             "closing_paise": "12345"})
                if any(row.get(field) != value for field, value in expected.items()):
                    raise AssertionError(f"report snapshot amount drift for {requester_role}/{name}")
        for role in owned_tasks:
            _, token = actors[role]
            other = next(task for owner, task in owned_tasks.items() if owner != role)
            status, body = rpc(base, public_key, token, "list_work_task_participants",
                               {"p_task_id": other})
            if status != 403 or not isinstance(body, dict) or body.get("code") != "42501":
                raise AssertionError(f"other owner's participants leaked to {role}: HTTP {status}")
        print(f"{len(allowed_jobs)} permitted read-only calls across {len(read_cases)} RPCs, four report requests and three task-owner denials passed")
        denial_jobs = [(role, case) for case in cases for role in ROLES
                       if role not in case["roles"]]

        def deny(job):
            role, case = job
            _, token = actors[role]
            status, body = rpc(base, public_key, token, case["rpc"],
                               {name: None for name in case["args"]})
            code = body.get("code") if isinstance(body, dict) else None
            return role, case["rpc"], status, code

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            denial_results = list(pool.map(deny, denial_jobs))
        unexpected = [item for item in denial_results if item[2:] != (403, "42501")]
        if unexpected:
            raise AssertionError(f"guarded RPC wrong-role responses: {unexpected[:12]}")
        print(f"{len(denial_results)} wrong-role API calls across {len(cases)} guarded RPCs passed")

        expired = expired_local_token(config["JWT_SECRET"], actors["president"][0])
        expired_status, _ = rpc(base, public_key, expired, "list_finance_accounts")
        if expired_status != 401:
            raise AssertionError(f"expired local JWT was not rejected: HTTP {expired_status}")
        print("expired local JWT rejected by Data API")

        actor_id, token = actors["data_entry"]
        sql(f"update public.app_users set role='treasurer' where id='{actor_id}'")
        if assert_response(base, public_key, token, "current_app_role", True) != "treasurer":
            raise AssertionError("role change was not reflected in the existing session")
        assert_response(base, public_key, token, "list_finance_accounts", True)
        sql(f"update public.app_users set active=false where id='{actor_id}'")
        if rpc(base, public_key, token, "current_app_role") != (200, None):
            raise AssertionError("inactive actor still has a projected role")
        assert_response(base, public_key, token, "list_finance_accounts", False)
        assert_response(base, public_key, token, "list_monthly_donors", False)
        print("existing issued token followed server role change and lost access after deactivation")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, text=True, capture_output=True, check=False)
        if reset.returncode:
            print(reset.stderr.strip(), file=sys.stderr)
            raise RuntimeError("local cleanup reset failed")
        print("fresh local database reset completed after eight-role session test")


if __name__ == "__main__":
    main()
