#!/usr/bin/env python3
"""Check permitted read-only RPCs with eight issued hosted development sessions.

Requires eight dashboard-created synthetic users and bounded SQL fixtures.
Never pass a production project or real user credentials to this runner.
"""

import argparse
import json
import os
import pathlib
import uuid

from phase3_hosted_rpc_denials import PROJECT_ID, PROJECT_URL, ROLES, request
from phase3_issued_role_matrix import READ_ARGUMENTS, READ_ONLY_RPCS


MATRIX = pathlib.Path(__file__).resolve().parents[1] / "tests" / "hosted_rpc_role_matrix.json"


def main(config_path):
    if os.environ.get("FRESH_HOSTED_ALLOWED_CONFIRM") != "isolated-dev-6ef102b1":
        raise SystemExit("Set FRESH_HOSTED_ALLOWED_CONFIRM=isolated-dev-6ef102b1")
    config = json.loads(config_path.read_text())
    matrix = json.loads(MATRIX.read_text())
    if config.get("project_url") != PROJECT_URL or matrix.get("project_id") != PROJECT_ID:
        raise SystemExit("Hosted target and RPC matrix differ")
    key, users = config.get("publishable_key", ""), config.get("users", [])
    if not key.startswith("sb_publishable_") or sorted(u.get("role") for u in users) != sorted(ROLES):
        raise SystemExit("Expected a publishable key and one synthetic user per role")
    if any(not u.get("email", "").startswith("phase-allow-") or
           not u["email"].endswith("-6ef102b1@example.com") for u in users):
        raise SystemExit("Unexpected synthetic user email")
    account_id = str(uuid.UUID(config["account_id"]))
    tasks = {role: str(uuid.UUID(task_id)) for role, task_id in config["owned_tasks"].items()}
    if set(tasks) != {"president", "vice_president", "secretary"}:
        raise SystemExit("Expected three creator-owned task fixtures")

    cases = [case for case in matrix["cases"] if case["rpc"] in READ_ONLY_RPCS]
    if len(cases) != len(READ_ONLY_RPCS) or len({c["rpc"] for c in cases}) != len(cases):
        raise SystemExit("Read-only RPC inventory drift")
    sessions = {}
    for user in users:
        status, signed = request(PROJECT_URL, key, "/auth/v1/token?grant_type=password",
                                 key, {"email": user["email"], "password": user["password"]})
        if status != 200 or not isinstance(signed, dict) or not signed.get("access_token"):
            raise AssertionError(f"issued sign-in failed for {user['role']}: HTTP {status}")
        token = signed["access_token"]
        status, live_role = request(PROJECT_URL, key, "/rest/v1/rpc/current_app_role", token, {})
        if (status, live_role) != (200, user["role"]):
            raise AssertionError(f"live role mismatch for {user['role']}: HTTP {status}")
        sessions[user["role"]] = token

    arguments = {**READ_ARGUMENTS, "p_account_id": account_id}
    checks = 0
    for case in cases:
        for role in case["roles"]:
            payload = {name: arguments[name] for name in case["args"]}
            if case["rpc"] == "list_work_task_participants":
                payload["p_task_id"] = tasks[role]
            status, body = request(PROJECT_URL, key, "/rest/v1/rpc/" + case["rpc"],
                                   sessions[role], payload)
            if status != 200:
                code = body.get("code") if isinstance(body, dict) else None
                raise AssertionError(f"allowed {role}/{case['rpc']}: HTTP {status}, code {code}")
            checks += 1
    for role in tasks:
        other_task = next(task for owner, task in tasks.items() if owner != role)
        status, body = request(PROJECT_URL, key, "/rest/v1/rpc/list_work_task_participants",
                               sessions[role], {"p_task_id": other_task})
        if status != 403 or not isinstance(body, dict) or body.get("code") != "42501":
            raise AssertionError(f"other owner's participants leaked to {role}: HTTP {status}")
    print(f"{len(sessions)} issued role sessions; {checks} permitted reads across {len(cases)} RPCs; "
          "three cross-creator task denials passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("credential_json", type=pathlib.Path)
    main(parser.parse_args().credential_json)
