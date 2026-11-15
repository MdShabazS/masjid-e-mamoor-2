#!/usr/bin/env python3
"""Exercise task capacity, FIFO promotion, and retry across independent sessions."""

import os
import select
import subprocess
import sys
import uuid
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_masjid-e-mamoor-2-fresh"
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"]


def sql(statement):
    result = subprocess.run(PSQL, input=statement, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def action(actor, function, task, operation, hold_seconds=0):
    return f"""
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
select set_config('request.jwt.claims','{{"sub":"{actor}","session_id":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
select public.{function}('{task}','{operation}');
reset role;
select pg_sleep({hold_seconds});
commit;
"""


def review(actor, task, member, decision, reason, operation, hold_seconds=0):
    return f"""
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
select set_config('request.jwt.claims','{{"sub":"{actor}","session_id":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
select public.review_work_task_completion('{task}','{member}','{decision}',{reason},'{operation}');
reset role;
select pg_sleep({hold_seconds});
commit;
"""


def actor_query(actor, statement):
    return sql(f"""
begin;
select set_config('request.jwt.claims','{{"sub":"{actor}","session_id":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
{statement}
commit;
""").splitlines()[-1]


def race(first, second, first_status, second_exit=0):
    a = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True)
    a.stdin.write(first)
    a.stdin.close()
    first_lines = []
    while True:
        readable, _, _ = select.select([a.stdout], [], [], 8)
        if not readable:
            a.kill()
            a.wait()
            raise AssertionError("first session did not reach its transaction hold")
        line = a.stdout.readline()
        first_lines.append(line)
        if line.strip() == first_status:
            break
        if not line:
            a.wait()
            raise AssertionError(f"first session exited early: {a.stderr.read().strip()}")
    b = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True)
    b.stdin.write(second)
    b.stdin.close()
    a_out, a_err = "".join(first_lines) + a.stdout.read(), a.stderr.read()
    b_out, b_err = b.stdout.read(), b.stderr.read()
    a.wait(timeout=15)
    b.wait(timeout=15)
    if a.returncode or b.returncode != second_exit:
        raise AssertionError(f"session exits {a.returncode}/{b.returncode}: {a_err.strip()} | {b_err.strip()}")
    return a_out.splitlines(), b_out.splitlines(), b_err


def require_status(lines, expected):
    if lines.count(expected) != 1:
        raise AssertionError(f"expected one {expected} result, got {lines}")


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable for the fresh local stack")
    if sql("select current_database(), count(*) from auth.users") != "postgres|0":
        raise SystemExit("Fresh local database must have zero Auth users")
    if sql("select count(*) from public.work_tasks") != "0":
        raise SystemExit("Fresh local database must have zero work tasks")
    if sql("select count(*) from public.finance_effects") != "0":
        raise SystemExit("Fresh local database must have zero finance effects")

    president, a, b, c, d = (str(uuid.uuid4()) for _ in range(5))
    users = [(president, "president"), (a, "member"), (b, "member"),
             (c, "member"), (d, "member")]
    auth_values = ",".join(
        f"('{user}','00000000-0000-0000-0000-000000000000','authenticated','authenticated',"
        f"'phase8-{index}@fixture.invalid','',now(),now(),now())"
        for index, (user, _) in enumerate(users)
    )
    app_values = ",".join(f"('{user}','{role}')" for user, role in users)
    session_values = ",".join(f"('{user}','{user}')" for user, _ in users)
    alias_values = ",".join(
        f"('{user}','phase8race{index}',false)" for index, (user, _) in enumerate(users)
    )
    fixture = f"""
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
 values {auth_values};
insert into public.app_users(id,role) values {app_values};
insert into auth.sessions(id,user_id) values {session_values};
insert into app_private.username_aliases(user_id,username,must_change_password)
 values {alias_values};
commit;
"""
    try:
        sql(fixture)
        def create_task(label):
            output = sql(f"""
begin;
select set_config('request.jwt.claims','{{"sub":"{president}","session_id":"{president}","role":"authenticated"}}',true);
set local role authenticated;
select public.create_work_task('Synthetic {label}','Independent-session capacity fixture',
 current_date,'Fixture room','open',1,0,1,'{uuid.uuid4()}');
commit;
""")
            ids = [line for line in output.splitlines() if len(line) == 36 and line.count("-") == 4]
            if len(ids) != 1:
                raise AssertionError(f"task creation returned {output}")
            return ids[0]

        task = create_task("last slot")
        left, right, _ = race(action(a, "join_work_task", task, uuid.uuid4(), 2),
                           action(b, "join_work_task", task, uuid.uuid4()), "confirmed")
        require_status(left, "confirmed")
        require_status(right, "waitlisted")
        if sql(f"select count(*) filter(where status='confirmed'),count(*) filter(where status='waitlisted') from public.work_task_participants where task_id='{task}'") != "1|1":
            raise AssertionError("last-slot race exceeded capacity or lost waitlist entry")
        print("last-slot race: one confirmed, one waitlisted")

        require_status(sql(action(c, "join_work_task", task, uuid.uuid4())).splitlines(), "waitlisted")
        left, right, _ = race(action(a, "leave_work_task", task, uuid.uuid4(), 2),
                           action(d, "join_work_task", task, uuid.uuid4()), "withdrawn")
        require_status(left, "withdrawn")
        require_status(right, "waitlisted")
        state = sql(f"""
select string_agg(member_id::text || ':' || status,',' order by queue_no)
from public.work_task_participants where task_id='{task}' and status<>'withdrawn';
""")
        if state != f"{b}:confirmed,{c}:waitlisted,{d}:waitlisted":
            raise AssertionError(f"leave/join race violated FIFO: {state}")
        require_status(sql(action(b, "leave_work_task", task, uuid.uuid4())).splitlines(), "withdrawn")
        if sql(f"select member_id::text from public.work_task_participants where task_id='{task}' and status='confirmed'") != c:
            raise AssertionError("second release did not promote oldest remaining waiter")
        print("leave/join race: oldest waiter promoted before newcomer; next release promoted next waiter")

        retry_task = create_task("retry")
        operation = uuid.uuid4()
        left, right, _ = race(action(a, "join_work_task", retry_task, operation, 2),
                           action(a, "join_work_task", retry_task, operation), "confirmed")
        require_status(left, "confirmed")
        require_status(right, "confirmed")
        if sql(f"select (select count(*) from public.work_task_participants where task_id='{retry_task}'),(select count(*) from public.work_task_operations where id='{operation}')") != "1|1":
            raise AssertionError("same-operation retry duplicated participation or operation")
        print("same-operation retry: one participant and one operation across two sessions")

        actor_query(a, f"select public.submit_work_task_completion('{retry_task}','synthetic work','{uuid.uuid4()}');")
        left, _, denial = race(
            review(president, retry_task, a, "accept", "null", uuid.uuid4(), 2),
            review(president, retry_task, a, "return", "'needs more evidence'", uuid.uuid4()),
            retry_task, second_exit=3,
        )
        require_status(left, retry_task)
        if "completion_not_submitted" not in denial:
            raise AssertionError(f"competing review failed for another reason: {denial.strip()}")
        if actor_query(a, "select public.my_verified_task_count();") != "1":
            raise AssertionError("accepted review did not award exactly one verified task")
        actor_query(president, f"select public.cancel_work_task('{retry_task}','synthetic cancellation','{uuid.uuid4()}');")
        if actor_query(a, "select public.my_verified_task_count();") != "0":
            raise AssertionError("cancelled task still counted as verified")
        print("competing reviews: one accepted, second denied; cancellation reversed verified count")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, text=True, capture_output=True, check=False)
        if reset.returncode:
            print("WARNING: disposable local reset failed; synthetic rows may remain", file=sys.stderr)
            raise RuntimeError("local cleanup reset failed")
        print("fresh local database reset completed after race")


if __name__ == "__main__":
    main()
