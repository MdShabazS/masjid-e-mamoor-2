#!/usr/bin/env python3
"""Exercise every guarded RPC with each disallowed issued role session.

The credential file is temporary, outside the repository, and must contain
exactly one synthetic user for each application role. Calls use null arguments
so an authorization regression cannot create a valid finance/task record.
"""

import argparse
import concurrent.futures
import json
import os
import pathlib
import urllib.error
import urllib.request


PROJECT_ID = "necattvpncnsrfcrwpjn"
PROJECT_URL = f"https://{PROJECT_ID}.supabase.co"
ROLES = (
    "system_admin", "president", "vice_president", "secretary", "treasurer",
    "committee_member", "member", "data_entry",
)
MATRIX = pathlib.Path(__file__).resolve().parents[1] / "tests" / "hosted_rpc_role_matrix.json"


def request(base, key, path, bearer, payload):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": "Bearer " + bearer,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    return status, json.loads(raw) if raw else None


def main(config_path):
    if os.environ.get("FRESH_HOSTED_RPC_CONFIRM") != "isolated-dev-6ef102b1":
        raise SystemExit("Set FRESH_HOSTED_RPC_CONFIRM=isolated-dev-6ef102b1")
    config = json.loads(config_path.read_text())
    matrix = json.loads(MATRIX.read_text())
    if config.get("project_url") != PROJECT_URL or matrix.get("project_id") != PROJECT_ID:
        raise SystemExit("Hosted target and checked RPC matrix differ")
    key = config.get("publishable_key", "")
    users = config.get("users", [])
    if not key.startswith("sb_publishable_") or sorted(u.get("role") for u in users) != sorted(ROLES):
        raise SystemExit("Expected a publishable key and eight distinct role fixtures")
    if any(not u.get("email", "").startswith("phase-rpc-") or
           not u["email"].endswith("-6ef102b1@example.com") for u in users):
        raise SystemExit("Unexpected synthetic user email")
    cases = matrix.get("cases", [])
    if len(cases) != matrix.get("guarded_rpc_count") or len({c["rpc"] for c in cases}) != len(cases):
        raise SystemExit("RPC matrix count or uniqueness drift")
    if any(not set(c["roles"]).issubset(ROLES) or not c["roles"] for c in cases):
        raise SystemExit("RPC matrix contains an invalid role")

    sessions = {}
    for user in users:
        status, signed = request(config["project_url"], key,
                                 "/auth/v1/token?grant_type=password", key,
                                 {"email": user["email"], "password": user["password"]})
        if status != 200 or not isinstance(signed, dict) or not signed.get("access_token"):
            raise AssertionError(f"issued sign-in failed for {user['role']}: HTTP {status}")
        token = signed["access_token"]
        status, live_role = request(config["project_url"], key,
                                    "/rest/v1/rpc/current_app_role", token, {})
        if (status, live_role) != (200, user["role"]):
            raise AssertionError(f"live role mismatch for {user['role']}: HTTP {status}")
        sessions[user["role"]] = token

    jobs = [(role, case) for case in cases for role in ROLES if role not in case["roles"]]

    def check(item):
        role, case = item
        status, body = request(config["project_url"], key,
                               "/rest/v1/rpc/" + case["rpc"], sessions[role],
                               {name: None for name in case["args"]})
        code = body.get("code") if isinstance(body, dict) else None
        return role, case["rpc"], status, code

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(check, jobs))
    failed = [item for item in results if item[2:] != (403, "42501")]
    print(f"{len(sessions)} issued role sessions; {len(cases)} guarded RPCs; "
          f"{len(results)} wrong-role API checks")
    if failed:
        print(json.dumps({"unexpected": failed}, indent=2))
        raise AssertionError(f"{len(failed)} wrong-role RPC responses need review")
    print("All wrong-role calls returned HTTP 403 / SQLSTATE 42501")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("credential_json", type=pathlib.Path)
    main(parser.parse_args().credential_json)
