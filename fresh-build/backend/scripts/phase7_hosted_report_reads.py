#!/usr/bin/env python3
"""Check hosted report snapshots using five disposable issued Auth sessions.

The user fixture must be created in the isolated development dashboard first.
This runner does not delete users or rows; clean them up separately afterward.
"""

import argparse
import json
import os
import pathlib
import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from phase3_hosted_rpc_denials import PROJECT_ID, PROJECT_URL, request


ROLES = ("system_admin", "president", "vice_president", "secretary", "treasurer")
REQUESTERS = ("president", "vice_president", "secretary", "treasurer")


def rpc(key, token, name, arguments=None):
    return request(PROJECT_URL, key, "/rest/v1/rpc/" + name, token, arguments or {})


def require_ok(key, token, name, arguments=None):
    status, body = rpc(key, token, name, arguments)
    if status != 200:
        code = body.get("code") if isinstance(body, dict) else None
        raise AssertionError(f"{name}: HTTP {status}, code {code}")
    return body


def main(path):
    if os.environ.get("FRESH_HOSTED_REPORT_CONFIRM") != "isolated-dev-6ef102b1":
        raise SystemExit("Set FRESH_HOSTED_REPORT_CONFIRM=isolated-dev-6ef102b1")
    config = json.loads(path.read_text())
    if config.get("project_id") != PROJECT_ID or config.get("project_url") != PROJECT_URL:
        raise SystemExit("Unexpected hosted project")
    key, users = config.get("publishable_key", ""), config.get("users", [])
    if not key.startswith("sb_publishable_") or sorted(u.get("role") for u in users) != sorted(ROLES):
        raise SystemExit("Expected a publishable key and exactly five report-role users")
    if any(not u.get("email", "").startswith(f"phase-report-{u['role']}-") or
           not u["email"].endswith("-6ef102b1@example.com") for u in users):
        raise SystemExit("Unexpected synthetic account naming")

    sessions = {}
    for user in users:
        status, signed = request(PROJECT_URL, key, "/auth/v1/token?grant_type=password",
                                 key, {"email": user["email"], "password": user["password"]})
        if status != 200 or not isinstance(signed, dict) or not signed.get("access_token"):
            raise AssertionError(f"{user['role']} sign-in: HTTP {status}")
        token = signed["access_token"]
        if require_ok(key, token, "current_app_role") != user["role"]:
            raise AssertionError(f"{user['role']} live role mismatch")
        sessions[user["role"]] = token

    account_id = require_ok(key, sessions["president"], "create_finance_account", {
        "p_name": "Synthetic hosted report account", "p_kind": "cash", "p_upi_id": None,
        "p_bank_account_number": None, "p_ifsc": None,
        "p_operation_id": str(uuid.uuid4()),
    })
    account_id = str(uuid.UUID(account_id))
    opening_id = require_ok(key, sessions["treasurer"], "submit_account_opening", {
        "p_account_id": account_id, "p_amount_paise": 12345,
        "p_evidence_reference": "Synthetic hosted report opening",
        "p_operation_id": str(uuid.uuid4()),
    })
    require_ok(key, sessions["president"], "verify_account_opening", {
        "p_opening_id": opening_id, "p_operation_id": str(uuid.uuid4()),
    })

    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    start = date(today.year, today.month, 1)
    end = (date(today.year + 1, 1, 1) if today.month == 12
           else date(today.year, today.month + 1, 1))
    runs = {}
    for role in REQUESTERS:
        runs[role] = require_ok(key, sessions[role], "request_finance_report", {
            "p_kind": "month", "p_start": start.isoformat(),
            "p_end_exclusive": end.isoformat(), "p_include_proofs": False,
            "p_operation_id": str(uuid.uuid4()),
        })
        uuid.UUID(runs[role])

    status, body = rpc(key, sessions["system_admin"], "request_finance_report", {
        "p_kind": "month", "p_start": start.isoformat(),
        "p_end_exclusive": end.isoformat(), "p_include_proofs": False,
        "p_operation_id": str(uuid.uuid4()),
    })
    if status != 403 or not isinstance(body, dict) or body.get("code") != "42501":
        raise AssertionError("System Admin unexpectedly requested a report")

    reads = 0
    for role in ROLES:
        for name in ("list_finance_report_lines", "list_finance_report_balances"):
            rows = require_ok(key, sessions[role], name, {"p_run_id": runs["president"]})
            if not isinstance(rows, list) or len(rows) != 1:
                raise AssertionError(f"{role}/{name}: expected one snapshot row")
            row = rows[0]
            expected = ({"source_type": "account_opening", "amount_paise": "12345"}
                        if name.endswith("lines") else
                        {"account_id": account_id, "period_openings_paise": "12345",
                         "closing_paise": "12345"})
            if any(row.get(field) != value for field, value in expected.items()):
                raise AssertionError(f"{role}/{name}: snapshot drift")
            reads += 1
    for role in REQUESTERS:
        for name in ("list_finance_report_lines", "list_finance_report_balances"):
            rows = require_ok(key, sessions[role], name, {"p_run_id": runs[role]})
            if len(rows) != 1 or rows[0].get("amount_paise" if name.endswith("lines")
                                             else "closing_paise") != "12345":
                raise AssertionError(f"{role}/{name}: own run drift")
            reads += 1
    print(f"Five issued sessions, four report requests, {reads} exact report reads "
          "and System Admin request denial passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("credential_json", type=pathlib.Path)
    main(parser.parse_args().credential_json)
