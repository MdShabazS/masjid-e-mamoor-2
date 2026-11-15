#!/usr/bin/env python3
"""Issued-session finance/task races on the named isolated hosted dev project.

The credential JSON is temporary and must not be checked in. This script does
not remove immutable finance/task rows; use its manifest for bounded cleanup.
"""

import argparse
import concurrent.futures
import datetime
import json
import os
import pathlib
import threading
import urllib.error
import urllib.request
import uuid


PROJECT_URL = "https://necattvpncnsrfcrwpjn.supabase.co"


def call(base, key, method, path, bearer, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        base + path,
        data=body,
        method=method,
        headers={
            "apikey": key,
            "Authorization": "Bearer " + bearer,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            status, raw = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    return status, json.loads(raw) if raw else None


def main(config_path, manifest_path):
    if os.environ.get("FRESH_HOSTED_RACE_CONFIRM") != "isolated-dev-6ef102b1":
        raise SystemExit("Set FRESH_HOSTED_RACE_CONFIRM=isolated-dev-6ef102b1")
    config = json.loads(config_path.read_text())
    base, key = config["project_url"], config["publishable_key"]
    if base != PROJECT_URL or len(config["users"]) != 6 or not key.startswith("sb_publishable_"):
        raise SystemExit("Fixture target, publishable key or user count mismatch")
    if any(not user["email"].startswith("phasehost-") or
           not user["email"].endswith("-6ef102b1@example.com") for user in config["users"]):
        raise SystemExit("Unexpected fixture user email")
    manifest = {"account_ids": [], "task_ids": [], "operation_ids": []}
    manifest_lock = threading.Lock()

    def save_manifest():
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        manifest_path.chmod(0o600)

    def op():
        value = str(uuid.uuid4())
        with manifest_lock:
            manifest["operation_ids"].append(value)
            save_manifest()
        return value

    actors = []
    for user in config["users"]:
        status, signed = call(base, key, "POST", "/auth/v1/token?grant_type=password",
                              key, {"email": user["email"], "password": user["password"]})
        if status != 200 or not signed.get("access_token") or not signed.get("user", {}).get("id"):
            raise AssertionError(f"issued sign-in failed for {user['role']}: HTTP {status}")
        actors.append({"role": user["role"], "id": signed["user"]["id"],
                       "token": signed["access_token"]})

    def rpc(actor, name, payload=None):
        return call(base, key, "POST", "/rest/v1/rpc/" + name,
                    actor["token"], payload or {})

    def ok(actor, name, payload=None):
        status, data = rpc(actor, name, payload)
        if status != 200:
            code = data.get("code") if isinstance(data, dict) else None
            raise AssertionError(f"{name}: HTTP {status}, code {code}")
        return data

    def simultaneous(left, right):
        barrier = threading.Barrier(2)

        def run(action):
            barrier.wait(timeout=10)
            return action()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(run, left)
            b = pool.submit(run, right)
            return a.result(timeout=40), b.result(timeout=40)

    president, treasurer, *members = actors
    for actor in actors:
        if ok(actor, "current_app_role") != actor["role"]:
            raise AssertionError("issued token has wrong live role")
        gate = ok(actor, "current_identity_gate")
        gate = gate[0] if isinstance(gate, list) else gate
        if not gate.get("account_active") or gate.get("must_change_password"):
            raise AssertionError("fixture identity gate is not active")
    print("six independently issued Auth sessions have the expected live roles")

    def balances():
        return {item["account_id"]: int(item["balance_paise"])
                for item in ok(treasurer, "list_finance_accounts")}

    accounts = []
    for label in ("source", "target"):
        account_id = ok(president, "create_finance_account", {
            "p_name": f"Hosted fixture 6ef102b1 {label}", "p_kind": "cash",
            "p_upi_id": None, "p_bank_account_number": None, "p_ifsc": None,
            "p_operation_id": op(),
        })
        accounts.append(account_id)
        manifest["account_ids"].append(account_id)
        save_manifest()
    source, target = accounts
    for account_id, amount in ((source, 10000), (target, 0)):
        opening = ok(treasurer, "submit_account_opening", {
            "p_account_id": account_id, "p_amount_paise": amount,
            "p_evidence_reference": "synthetic hosted count", "p_operation_id": op(),
        })
        ok(president, "verify_account_opening", {
            "p_opening_id": opening, "p_operation_id": op(),
        })
    if (balances()[source], balances()[target]) != (10000, 0):
        raise AssertionError("verified hosted openings did not produce expected balances")

    def transfer(from_id, to_id, amount, operation):
        return rpc(treasurer, "post_finance_transfer", {
            "p_from_account_id": from_id, "p_to_account_id": to_id,
            "p_amount_paise": amount, "p_evidence_reference": "synthetic hosted transfer",
            "p_operation_id": operation,
        })

    first, second = simultaneous(
        lambda: transfer(source, target, 7000, op()),
        lambda: transfer(source, target, 7000, op()),
    )
    if sorted([first[0], second[0]]) != [200, 400] or "insufficient_account_balance" not in str((first, second)):
        raise AssertionError(f"competing transfer did not reject exactly one overdraw: {first[0]}/{second[0]}")
    if (balances()[source], balances()[target]) != (3000, 7000):
        raise AssertionError("competing transfer balance mismatch")
    replay_op = op()
    first, second = simultaneous(
        lambda: transfer(source, target, 1000, replay_op),
        lambda: transfer(source, target, 1000, replay_op),
    )
    if first[0] != 200 or second[0] != 200 or first[1] != second[1]:
        raise AssertionError("same-operation transfer replay failed")
    first, second = simultaneous(
        lambda: transfer(source, target, 1000, op()),
        lambda: transfer(target, source, 1000, op()),
    )
    if first[0] != 200 or second[0] != 200 or (balances()[source], balances()[target]) != (2000, 8000):
        raise AssertionError("opposite-direction transfers did not reconcile")
    print("hosted transfer overdraw, same-operation replay and opposite-direction requests passed")

    def new_task(label):
        task_id = ok(president, "create_work_task", {
            "p_title": f"Hosted fixture 6ef102b1 {label}",
            "p_description": "Synthetic hosted concurrency check",
            "p_date": datetime.date.today().isoformat(), "p_location": "Fixture room",
            "p_mode": "open", "p_total": 1, "p_invited": 0,
            "p_volunteer": 1, "p_operation_id": op(),
        })
        manifest["task_ids"].append(task_id)
        save_manifest()
        return task_id

    def join(actor, task_id, operation):
        return rpc(actor, "join_work_task", {"p_task_id": task_id,
                                              "p_operation_id": operation})

    def my_status(actor, task_id):
        items = ok(actor, "list_visible_work_tasks")
        return next((item["my_status"] for item in items if item["task_id"] == task_id), None)

    task = new_task("last slot")
    first, second = simultaneous(
        lambda: join(members[0], task, op()),
        lambda: join(members[1], task, op()),
    )
    if sorted([first, second], key=str) != sorted([(200, "confirmed"), (200, "waitlisted")], key=str):
        raise AssertionError(f"last-slot race failed: {first[0]}/{second[0]}")
    confirmed = members[0] if my_status(members[0], task) == "confirmed" else members[1]
    waiter = members[1] if confirmed is members[0] else members[0]
    if my_status(waiter, task) != "waitlisted":
        raise AssertionError("last-slot status projection mismatch")
    if join(members[2], task, op()) != (200, "waitlisted"):
        raise AssertionError("third member did not join waitlist")
    leave, new_join = simultaneous(
        lambda: rpc(confirmed, "leave_work_task", {"p_task_id": task,
                                                    "p_operation_id": op()}),
        lambda: join(members[3], task, op()),
    )
    if leave != (200, "withdrawn") or new_join != (200, "waitlisted"):
        raise AssertionError("leave/join race did not preserve capacity")
    if my_status(waiter, task) != "confirmed" or my_status(members[2], task) != "waitlisted":
        raise AssertionError("FIFO promotion failed")
    ok(waiter, "leave_work_task", {"p_task_id": task, "p_operation_id": op()})
    if my_status(members[2], task) != "confirmed":
        raise AssertionError("second FIFO promotion failed")
    print("hosted task last slot and FIFO promotion passed")

    retry_task = new_task("retry review")
    replay_op = op()
    first, second = simultaneous(
        lambda: join(members[0], retry_task, replay_op),
        lambda: join(members[0], retry_task, replay_op),
    )
    if first != (200, "confirmed") or second != (200, "confirmed"):
        raise AssertionError("task same-operation replay failed")
    ok(members[0], "submit_work_task_completion", {
        "p_task_id": retry_task, "p_note": "synthetic hosted work", "p_operation_id": op(),
    })
    review_args = {"p_task_id": retry_task, "p_member_id": members[0]["id"],
                   "p_decision": "accept", "p_reason": None}
    first, second = simultaneous(
        lambda: rpc(president, "review_work_task_completion",
                    {**review_args, "p_operation_id": op()}),
        lambda: rpc(president, "review_work_task_completion",
                    {**review_args, "p_operation_id": op()}),
    )
    if sorted([first[0], second[0]]) != [200, 400] or "completion_not_submitted" not in str((first, second)):
        raise AssertionError("competing completion reviews were not single-winner")
    if int(ok(members[0], "my_verified_task_count")) != 1:
        raise AssertionError("accepted task counted other than once")
    ok(president, "cancel_work_task", {
        "p_task_id": retry_task, "p_reason": "synthetic hosted cancellation",
        "p_operation_id": op(),
    })
    if int(ok(members[0], "my_verified_task_count")) != 0:
        raise AssertionError("cancelled task still earns a count")
    print("hosted task retry, review race and verified-count reversal passed")
    save_manifest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("credential_json", type=pathlib.Path)
    parser.add_argument("manifest_json", type=pathlib.Path)
    args = parser.parse_args()
    main(args.credential_json, args.manifest_json)
