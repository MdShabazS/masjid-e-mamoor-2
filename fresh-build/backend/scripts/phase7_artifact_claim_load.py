#!/usr/bin/env python3
"""Disposable independent-session claim, expiry and bounded queue-load proof."""

import os
import subprocess
import time
import uuid
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_masjid-e-mamoor-2-fresh"
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres",
        "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"]


def sql(statement):
    result = subprocess.run(PSQL, input=statement, text=True, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def parse_claim(value):
    parts = value.strip().split("|")
    if len(parts) != 3 or parts[1] not in ("csv", "pdf"):
        raise AssertionError(f"invalid claim: {value!r}")
    uuid.UUID(parts[0])
    uuid.UUID(parts[2])
    return parts


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable")
    if sql("select (select count(*) from auth.users),(select count(*) from public.finance_report_runs),"
           "(select count(*) from storage.objects)") != "0|0|0":
        raise SystemExit("Fresh local database must have no Auth users, reports or objects")
    actor = str(uuid.uuid4())
    try:
        sql(f"""
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values ('{actor}','00000000-0000-0000-0000-000000000000','authenticated',
 'authenticated','phase7-load@fixture.invalid','',now(),now(),now());
insert into public.app_users(id,role) values ('{actor}','president');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{actor}','phase7load',false);
insert into public.finance_report_runs(operation_id,requested_by,period_kind,
 start_date,end_exclusive_date,include_proofs)
select gen_random_uuid(),'{actor}'::uuid,'month',date '2026-10-01',date '2026-11-01',false
from generate_series(1,64);
""")
        claim_sql = """begin;
set local statement_timeout='20s';
set local role service_role;
select run_id||'|'||format||'|'||lease_token from public.claim_finance_report_artifact();
select pg_sleep(0.25);
commit;
"""
        workers = [subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, text=True) for _ in range(8)]
        try:
            for worker in workers:
                worker.stdin.write(claim_sql)
                worker.stdin.close()
                worker.stdin = None
            results = [worker.communicate(timeout=25) for worker in workers]
        finally:
            for worker in workers:
                if worker.poll() is None:
                    worker.kill()
                    worker.wait(timeout=5)
        claims = []
        for worker, (stdout, stderr) in zip(workers, results):
            if worker.returncode:
                raise AssertionError(f"concurrent claim failed: {stderr.strip()}")
            line = next((line for line in stdout.splitlines() if line.count("|") == 2), None)
            if line is None:
                raise AssertionError(f"concurrent claim returned no row: {stdout!r}")
            claims.append(parse_claim(line))
        if len({(run, fmt) for run, fmt, _ in claims}) != 8:
            raise AssertionError("concurrent workers claimed the same report format")
        if sql("select count(*) from public.finance_report_artifacts where status='processing'") != "8":
            raise AssertionError("processing state count after concurrent claim mismatch")

        expired_run, expired_format, expired_lease = claims[0]
        expired_path = f"{expired_run}/{expired_format}/{expired_lease}.{expired_format}"
        sql(f"update public.finance_report_artifacts set lease_expires_at=now()-interval '1 second' "
            f"where run_id='{expired_run}' and format='{expired_format}';")
        stale_finish = sql(f"""begin; set local role service_role;
select public.finish_finance_report_artifact('{expired_run}','{expired_format}',
 '{expired_lease}','{expired_path}',repeat('a',64),10);
commit;""")
        if stale_finish != "f":
            raise AssertionError("expired worker was allowed to finish")
        next_claim = sql("begin; set local role service_role; "
                         "select run_id||'|'||format||'|'||lease_token "
                         "from public.claim_finance_report_artifact(); commit;")
        additional = parse_claim(next_claim)
        if additional[:2] == claims[0][:2]:
            raise AssertionError("expired lease was automatically reclaimed")
        expired_state = sql(f"select status,attempts,failure_code,last_attempt_path "
                            f"from public.finance_report_artifacts where run_id='{expired_run}' "
                            f"and format='{expired_format}'")
        if expired_state != f"failed|3|lease_expired|{expired_path}":
            raise AssertionError(f"expired lease state/path mismatch: {expired_state}")
        stale_failure = sql(f"""begin; set local role service_role;
select public.fail_finance_report_artifact('{expired_run}','{expired_format}',
 '{expired_lease}','render_failed',false);
commit;""")
        if stale_failure != "f":
            raise AssertionError("expired worker was allowed to change terminal failure")

        for run, fmt, lease in claims[1:] + [additional]:
            outcome = sql(f"""begin; set local role service_role;
select public.fail_finance_report_artifact('{run}','{fmt}','{lease}',
 'render_failed',true);
commit;""")
            if outcome != "t":
                raise AssertionError("valid terminal failure rejected")
        started = time.perf_counter()
        drained = sql("""begin; set local role service_role;
do $$ declare item record; total integer:=0;
begin
 loop
  select * into item from public.claim_finance_report_artifact();
  exit when not found;
  if not public.fail_finance_report_artifact(item.run_id,item.format,
    item.lease_token,'render_failed',true) then
   raise exception 'load claim could not be failed'; end if;
  total:=total+1;
  if total>128 then raise exception 'artifact claim loop did not drain'; end if;
 end loop;
 if total<>119 then raise exception 'drain count mismatch: %',total; end if;
end $$;
commit;""")
        if drained:
            raise AssertionError(f"unexpected drain output: {drained}")
        elapsed = time.perf_counter() - started
        counts = sql("select count(*),count(*) filter(where status='failed'),"
                     "count(distinct run_id),count(*) filter(where failure_code='lease_expired') "
                     "from public.finance_report_artifacts")
        if counts != "128|128|64|1":
            raise AssertionError(f"loaded queue did not drain exactly: {counts}")
        if sql("begin; set local role service_role; "
               "select count(*) from public.claim_finance_report_artifact(); commit;") != "0":
            raise AssertionError("drained queue produced another claim")
        print(f"artifact claim load: 8 distinct concurrent claims, one terminal expiry, "
              f"128/128 formats drained across 64 runs in {elapsed:.3f}s")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, capture_output=True, text=True, check=False)
        if reset.returncode:
            raise RuntimeError(f"disposable reset failed: {reset.stderr.strip()}")
        print("fresh local database reset after artifact claim load")


if __name__ == "__main__":
    main()
