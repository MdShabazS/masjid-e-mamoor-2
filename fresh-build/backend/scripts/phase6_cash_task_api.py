#!/usr/bin/env python3
"""Issued-session cash task and cross-path slip race on the disposable stack."""

import json
import os
import secrets
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

from phase4_auth_api import BACKEND, expect, request, sql


def operation():
    return str(uuid.uuid4())


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
            email = f"phase6task-{role}-{secrets.token_hex(5)}@fixture.invalid"
            password = secrets.token_urlsafe(30)
            code, created = request(base, "POST", "/auth/v1/admin/users", admin, admin,
                                    {"email": email, "password": password, "email_confirm": True})
            if code != 200 or not created.get("id"):
                raise AssertionError(f"Auth create {role}: HTTP {code}")
            user_id = str(uuid.UUID(created["id"]))
            sql(f"""insert into public.app_users(id,role) values ('{user_id}','{role}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{user_id}','phase6task{role}{secrets.token_hex(3)}',false);""")
            code, signed_in = request(base, "POST", "/auth/v1/token?grant_type=password",
                                      anon, anon, {"email": email, "password": password})
            if code != 200 or not signed_in.get("access_token"):
                raise AssertionError(f"Auth sign in {role}: HTTP {code}")
            tokens[role] = signed_in["access_token"]

        account = expect(base, "create_finance_account", anon, tokens["president"], {
            "p_name": "Synthetic collection cash", "p_kind": "cash", "p_upi_id": None,
            "p_bank_account_number": None, "p_ifsc": None, "p_operation_id": operation(),
        })
        opening = expect(base, "submit_account_opening", anon, tokens["treasurer"], {
            "p_account_id": account, "p_amount_paise": 10000,
            "p_evidence_reference": "Synthetic collection opening", "p_operation_id": operation(),
        })
        expect(base, "verify_account_opening", anon, tokens["president"], {
            "p_opening_id": opening, "p_operation_id": operation(),
        })

        def create_task(title):
            return expect(base, "create_cash_collection_task", anon, tokens["president"], {
                "p_title": title, "p_description": "Synthetic collection count",
                "p_date": None, "p_location": None, "p_mode": "open",
                "p_total": 1, "p_invited": 0, "p_volunteer": 1,
                "p_operation_id": operation(),
            })

        today = datetime.now(ZoneInfo("Asia/Kolkata")).date().isoformat()
        task = create_task("Synthetic Friday collection")
        expect(base, "join_work_task", anon, tokens["member"], {
            "p_task_id": task, "p_operation_id": operation(),
        })
        count_args = {"p_task_id": task, "p_date": today, "p_amount_paise": 1500,
                      "p_evidence": "Synthetic collection slip A", "p_operation_id": operation()}
        expect(base, "submit_cash_task_count", anon, tokens["treasurer"], count_args, 403)
        count_id = expect(base, "submit_cash_task_count", anon, tokens["member"], count_args)
        if expect(base, "submit_cash_task_count", anon, tokens["member"], count_args) != count_id:
            raise AssertionError("counter replay changed count ID")
        expect(base, "verify_cash_task_count", anon, tokens["member"], {
            "p_count_id": count_id, "p_actual_amount_paise": 1400,
            "p_account_id": account, "p_operation_id": operation(),
        }, 403)
        workflow = expect(base, "list_cash_collection_workflow", anon, tokens["treasurer"], {})
        if not any(item["count_id"] == count_id and item["claimed_amount_paise"] == "1500"
                   for item in workflow):
            raise AssertionError("Treasurer pending count projection missing")
        verify_args = {"p_count_id": count_id, "p_actual_amount_paise": 1400,
                       "p_account_id": account, "p_operation_id": operation()}
        donation = expect(base, "verify_cash_task_count", anon, tokens["treasurer"], verify_args)
        if expect(base, "verify_cash_task_count", anon, tokens["treasurer"], verify_args) != donation:
            raise AssertionError("cash verification replay changed donation ID")

        def direct(slip, amount):
            return {"p_name": "Synthetic direct donor", "p_kind": "other",
                    "p_referrer_id": None, "p_date": today, "p_amount_paise": amount,
                    "p_evidence": slip, "p_account_id": account,
                    "p_operation_id": operation()}

        code, body = request(base, "POST", "/rest/v1/rpc/post_direct_treasurer_cash",
                             anon, tokens["treasurer"], direct(" SYNTHETIC COLLECTION SLIP A ", 1400))
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("task slip reused through direct path")
        expect(base, "post_direct_treasurer_cash", anon, tokens["treasurer"],
               direct("Synthetic collection slip B", 200))
        second = create_task("Synthetic second collection")
        expect(base, "join_work_task", anon, tokens["member"], {
            "p_task_id": second, "p_operation_id": operation(),
        })
        code, body = request(base, "POST", "/rest/v1/rpc/submit_cash_task_count",
                             anon, tokens["member"], {"p_task_id": second, "p_date": today,
                             "p_amount_paise": 200, "p_evidence": " SYNTHETIC COLLECTION SLIP B ",
                             "p_operation_id": operation()})
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("direct slip reused through collection task")

        third = create_task("Synthetic race collection")
        expect(base, "join_work_task", anon, tokens["member"], {
            "p_task_id": third, "p_operation_id": operation(),
        })
        count_race = {"p_task_id": third, "p_date": today, "p_amount_paise": 300,
                      "p_evidence": "Synthetic race slip C", "p_operation_id": operation()}
        direct_race = direct(" SYNTHETIC RACE SLIP C ", 300)
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_count = executor.submit(request, base, "POST",
                "/rest/v1/rpc/submit_cash_task_count", anon, tokens["member"], count_race)
            future_direct = executor.submit(request, base, "POST",
                "/rest/v1/rpc/post_direct_treasurer_cash", anon, tokens["treasurer"], direct_race)
            count_result, direct_result = future_count.result(), future_direct.result()
        if sorted([count_result[0], direct_result[0]]) != [200, 409] or not any(
                code == 409 and body.get("code") == "23505"
                for code, body in (count_result, direct_result)):
            raise AssertionError("simultaneous cross-path same slip did not resolve once")
        if count_result[0] == 200:
            expect(base, "verify_cash_task_count", anon, tokens["treasurer"], {
                "p_count_id": count_result[1], "p_actual_amount_paise": 300,
                "p_account_id": account, "p_operation_id": operation(),
            })
        generic = expect(base, "submit_one_time_donation", anon, tokens["president"], {
            "p_name": "Generic cash donor", "p_kind": "other", "p_referrer_id": None,
            "p_date": today, "p_method": "cash", "p_amount_paise": 400,
            "p_evidence": "Synthetic generic slip D", "p_operation_id": operation(),
        })
        expect(base, "decide_one_time_donation", anon, tokens["treasurer"], {
            "p_id": generic, "p_decision": "verify", "p_actual_paise": 400,
            "p_account_id": account, "p_reason": None, "p_operation_id": operation(),
        })
        fourth = create_task("Synthetic generic collision")
        expect(base, "join_work_task", anon, tokens["member"], {
            "p_task_id": fourth, "p_operation_id": operation(),
        })
        code, body = request(base, "POST", "/rest/v1/rpc/submit_cash_task_count",
                             anon, tokens["member"], {"p_task_id": fourth, "p_date": today,
                             "p_amount_paise": 400, "p_evidence": " SYNTHETIC GENERIC SLIP D ",
                             "p_operation_id": operation()})
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("generic slip reused through task path")
        code, body = request(base, "POST", "/rest/v1/rpc/post_direct_treasurer_cash",
                             anon, tokens["treasurer"], direct("SYNTHETIC GENERIC SLIP D", 400))
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("generic slip reused through direct path")
        duplicate = expect(base, "submit_one_time_donation", anon, tokens["president"], {
            "p_name": "Duplicate task donor", "p_kind": "other", "p_referrer_id": None,
            "p_date": today, "p_method": "cash", "p_amount_paise": 100,
            "p_evidence": "Synthetic collection slip A", "p_operation_id": operation(),
        })
        code, body = request(base, "POST", "/rest/v1/rpc/decide_one_time_donation",
                             anon, tokens["treasurer"], {"p_id": duplicate,
                             "p_decision": "verify", "p_actual_paise": 100,
                             "p_account_id": account, "p_reason": None,
                             "p_operation_id": operation()})
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("task slip reused through generic verification")
        if sql("select coalesce(sum(amount_paise),0) from public.finance_effects "
               f"where account_id='{account}'") != "12300":
            raise AssertionError("cash account did not include exactly four posted amounts")
        if sql("select count(*) from public.cash_slip_claims") != "4":
            raise AssertionError("shared slip register did not reserve exactly four slips")
        first_count = expect(base, "submit_cash_task_count", anon, tokens["member"], {
            "p_task_id": fourth, "p_date": today, "p_amount_paise": 500,
            "p_evidence": "Synthetic correction slip E", "p_operation_id": operation(),
        })
        reject_args = {"p_count_id": first_count, "p_reason": "Count copied twice",
                       "p_operation_id": operation()}
        expect(base, "reject_cash_task_count", anon, tokens["president"], reject_args, 403)
        if expect(base, "reject_cash_task_count", anon, tokens["treasurer"],
                  reject_args) != first_count:
            raise AssertionError("rejected count ID changed")
        if expect(base, "reject_cash_task_count", anon, tokens["treasurer"],
                  reject_args) != first_count:
            raise AssertionError("exact rejection replay failed")
        member_view = expect(base, "list_cash_collection_workflow", anon, tokens["member"], {})
        if not any(item["task_id"] == fourth and item["count_status"] == "rejected"
                   and item["rejection_reason"] == "Count copied twice" for item in member_view):
            raise AssertionError("counter cannot see rejection reason")
        code, body = request(base, "POST", "/rest/v1/rpc/verify_cash_task_count",
                             anon, tokens["treasurer"], {"p_count_id": first_count,
                             "p_actual_amount_paise": 500, "p_account_id": account,
                             "p_operation_id": operation()})
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("rejected count was verified")
        code, body = request(base, "POST", "/rest/v1/rpc/submit_cash_task_count",
                             anon, tokens["member"], {"p_task_id": fourth, "p_date": today,
                             "p_amount_paise": 600, "p_evidence": "SYNTHETIC CORRECTION SLIP E",
                             "p_operation_id": operation()})
        if code != 409 or body.get("code") != "23505":
            raise AssertionError("rejected slip was reused")
        corrected = expect(base, "submit_cash_task_count", anon, tokens["member"], {
            "p_task_id": fourth, "p_date": today, "p_amount_paise": 600,
            "p_evidence": "Synthetic correction slip F", "p_operation_id": operation(),
        })
        expect(base, "verify_cash_task_count", anon, tokens["treasurer"], {
            "p_count_id": corrected, "p_actual_amount_paise": 550,
            "p_account_id": account, "p_operation_id": operation(),
        })
        if sql(f"select replaces_count_id from public.cash_task_counts where id='{corrected}'") != first_count:
            raise AssertionError("replacement audit link missing")

        fifth = create_task("Synthetic decision race")
        expect(base, "join_work_task", anon, tokens["member"], {
            "p_task_id": fifth, "p_operation_id": operation(),
        })
        race_count = expect(base, "submit_cash_task_count", anon, tokens["member"], {
            "p_task_id": fifth, "p_date": today, "p_amount_paise": 700,
            "p_evidence": "Synthetic decision race slip G", "p_operation_id": operation(),
        })
        with ThreadPoolExecutor(max_workers=2) as executor:
            rejection = executor.submit(request, base, "POST",
                "/rest/v1/rpc/reject_cash_task_count", anon, tokens["treasurer"],
                {"p_count_id": race_count, "p_reason": "Race rejection",
                 "p_operation_id": operation()})
            verification = executor.submit(request, base, "POST",
                "/rest/v1/rpc/verify_cash_task_count", anon, tokens["treasurer"],
                {"p_count_id": race_count, "p_actual_amount_paise": 700,
                 "p_account_id": account, "p_operation_id": operation()})
            rejection_result, verification_result = rejection.result(), verification.result()
        if sorted([rejection_result[0], verification_result[0]]) != [200, 409]:
            raise AssertionError("competing rejection/verification did not resolve once")
        if rejection_result[0] == 200:
            winner_amount = 750
            replacement = expect(base, "submit_cash_task_count", anon, tokens["member"], {
                "p_task_id": fifth, "p_date": today, "p_amount_paise": 800,
                "p_evidence": "Synthetic decision race correction H",
                "p_operation_id": operation(),
            })
            expect(base, "verify_cash_task_count", anon, tokens["treasurer"], {
                "p_count_id": replacement, "p_actual_amount_paise": winner_amount,
                "p_account_id": account, "p_operation_id": operation(),
            })
        else:
            winner_amount = 700
        if sql("select coalesce(sum(amount_paise),0) from public.finance_effects "
               f"where account_id='{account}'") != str(12850 + winner_amount):
            raise AssertionError("decision race posted the wrong cash amount")
        print("issued sessions, all cash routes, correction chain and reject/verify race passed")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, text=True, capture_output=True, check=False)
        if reset.returncode:
            raise RuntimeError(f"disposable reset failed: {reset.stderr.strip()}")
        print("fresh local database reset completed after cash task API test")


if __name__ == "__main__":
    main()
