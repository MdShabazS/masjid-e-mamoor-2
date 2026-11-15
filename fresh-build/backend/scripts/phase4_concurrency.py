#!/usr/bin/env python3
"""Run Phase 4 money races against the disposable local fresh-build stack."""

import os
import select
import subprocess
import sys
import uuid
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_masjid-e-mamoor-2-fresh"
PSQL = ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"]


def run_sql(sql):
    return subprocess.run(PSQL, input=sql, text=True, capture_output=True, check=False)


def require_sql(sql):
    result = run_sql(sql)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def transfer(actor, source, target, amount, operation, hold_seconds=0):
    return f"""
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
select set_config('request.jwt.claims','{{"sub":"{actor}","session_id":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
select public.post_finance_transfer('{source}','{target}',{amount},'synthetic transfer','{operation}');
reset role;
select pg_sleep({hold_seconds});
commit;
"""


def correction(actor, effect, account, amount, operation, hold_seconds=0):
    return f"""
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
select set_config('request.jwt.claims','{{"sub":"{actor}","session_id":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
select public.correct_finance_posting('{effect}','{account}',{amount},'synthetic revision','{operation}');
reset role;
select pg_sleep({hold_seconds});
commit;
"""


def expense_payment(actor, expense, account, amount, operation, hold_seconds=0):
    return f"""
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
select set_config('request.jwt.claims','{{"sub":"{actor}","session_id":"{actor}","role":"authenticated"}}',true);
set local role authenticated;
select public.post_expense_payment('{expense}','{account}',{amount},'cash',current_date,
 'synthetic paid receipt','{operation}');
reset role;
select pg_sleep({hold_seconds});
commit;
"""


def race(left, right, expected_left=0, expected_right=0):
    a = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True)
    a.stdin.write(left)
    a.stdin.close()
    # Wait for A's transfer result while its transaction remains open in
    # pg_sleep. This starts B only after A has acquired the account locks.
    first_output = []
    while True:
        readable, _, _ = select.select([a.stdout], [], [], 8)
        if not readable:
            a.kill()
            raise AssertionError("first transfer did not reach its lock hold")
        line = a.stdout.readline()
        first_output.append(line)
        try:
            uuid.UUID(line.strip())
            break
        except ValueError:
            if not line:
                raise AssertionError(f"first transfer exited before lock hold: {a.stderr.read().strip()}")
    b = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, text=True)
    b.stdin.write(right)
    b.stdin.close()
    a_out, a_err = "".join(first_output) + a.stdout.read(), a.stderr.read()
    b_out, b_err = b.stdout.read(), b.stderr.read()
    a.wait(timeout=15)
    b.wait(timeout=15)
    if a.returncode != expected_left or b.returncode != expected_right:
        raise AssertionError(f"race exits {a.returncode}/{b.returncode}: {a_err.strip()} | {b_err.strip()}")
    return a_out, b_out, b_err


def main():
    if os.environ.get("FRESH_BUILD_TEST_DATABASE_CONFIRM") != "disposable":
        raise SystemExit("Set FRESH_BUILD_TEST_DATABASE_CONFIRM=disposable for the fresh local stack")
    if require_sql("select current_database(), count(*) from auth.users") != "postgres|0":
        raise SystemExit("Fresh local database must have zero Auth users before the race")
    if require_sql("select count(*) from public.finance_effects") != "0":
        raise SystemExit("Fresh local database must have zero finance effects before the race")

    president, treasurer = str(uuid.uuid4()), str(uuid.uuid4())
    source, target = str(uuid.uuid4()), str(uuid.uuid4())
    opening_source, opening_target = str(uuid.uuid4()), str(uuid.uuid4())
    fixture = f"""
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values ('{president}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-president@fixture.invalid','',now(),now(),now()),
       ('{treasurer}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-treasurer@fixture.invalid','',now(),now(),now());
insert into public.app_users(id,role) values ('{president}','president'),('{treasurer}','treasurer');
insert into auth.sessions(id,user_id) values ('{president}','{president}'),('{treasurer}','{treasurer}');
insert into app_private.username_aliases(user_id,username,must_change_password)
values ('{president}','phase4racepresident',false),('{treasurer}','phase4racetreasurer',false);
insert into public.masjid_accounts(id,name,kind,create_operation_id)
values ('{source}','Race source','cash','{uuid.uuid4()}'),('{target}','Race target','cash','{uuid.uuid4()}');
insert into public.account_openings(id,account_id,amount_paise,evidence_reference,submitted_by,submit_operation_id,verified_by,verify_operation_id,verified_at)
values ('{opening_source}','{source}',10000,'synthetic count','{treasurer}','{uuid.uuid4()}','{president}','{uuid.uuid4()}',now()),
       ('{opening_target}','{target}',10000,'synthetic count','{treasurer}','{uuid.uuid4()}','{president}','{uuid.uuid4()}',now());
insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
values ('{source}','account_opening','{opening_source}',0,10000),
       ('{target}','account_opening','{opening_target}',0,10000);
commit;
"""
    try:
        require_sql(fixture)
        _, _, denial = race(
            transfer(treasurer, source, target, 7000, uuid.uuid4(), 2),
            transfer(treasurer, source, target, 7000, uuid.uuid4()),
            expected_right=3,
        )
        if "insufficient_account_balance" not in denial:
            raise AssertionError(f"second transfer failed for the wrong reason: {denial.strip()}")
        if require_sql(f"select sum(amount_paise::numeric) from public.finance_effects where account_id='{source}'") != "3000":
            raise AssertionError("competing transfers changed the source balance incorrectly")
        print("competing transfers: one posted, one rejected for insufficient balance")

        race(
            transfer(treasurer, source, target, 2000, uuid.uuid4(), 2),
            transfer(treasurer, target, source, 2000, uuid.uuid4()),
        )
        print("opposite-direction transfers: both posted without deadlock")

        operation = str(uuid.uuid4())
        a, b, _ = race(
            transfer(treasurer, source, target, 1000, operation, 2),
            transfer(treasurer, source, target, 1000, operation),
        )
        ids_a = [line for line in a.splitlines() if line == line.strip() and len(line) == 36 and line.count("-") == 4]
        ids_b = [line for line in b.splitlines() if line == line.strip() and len(line) == 36 and line.count("-") == 4]
        if len(ids_a) != 1 or ids_a != ids_b:
            raise AssertionError("same-operation retries did not return one transfer ID")
        print("same-operation retries: one transfer ID returned to both sessions")

        result = require_sql(f"""
select (select sum(amount_paise::numeric) from public.finance_effects where account_id='{source}'),
       (select sum(amount_paise::numeric) from public.finance_effects where account_id='{target}'),
       (select sum(amount_paise::numeric) from public.finance_effects where source_type='transfer'),
       (select count(*) from public.finance_transfers),
       (select count(*) from public.finance_effects where source_type='transfer');
""")
        if result != "2000|18000|0|4|8":
            raise AssertionError(f"independent ledger reconciliation mismatch: {result}")
        projection = require_sql(f"""
begin;
select set_config('request.jwt.claims','{{"sub":"{treasurer}","session_id":"{treasurer}","role":"authenticated"}}',true);
set local role authenticated;
select balance_paise from public.list_finance_accounts() where account_id='{source}';
select balance_paise from public.list_finance_accounts() where account_id='{target}';
rollback;
""")
        projected_amounts = [line for line in projection.splitlines() if line.isdecimal()]
        if projected_amounts != ["2000", "18000"]:
            raise AssertionError(f"finance account projection disagrees with effects: {projected_amounts}")
        print("independent effects: 2000 + 18000 = 20000 paise; four transfers, eight balanced legs")
        print("authorized account projection agrees with independent effect sums")

        donation, effect, receipt = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
        require_sql(f"""
begin;
insert into public.one_time_donations(id,submit_operation_id,donor_name,donor_kind,
 donation_date,payment_method,claimed_amount_paise,evidence_reference,submitted_by,
 status,decision_operation_id,decided_by,decided_at,actual_amount_paise,account_id,receipt_code)
values ('{donation}','{uuid.uuid4()}','Synthetic donor','other',current_date,'cash',5000,
 'synthetic proof','{president}','verified','{uuid.uuid4()}','{treasurer}',now(),5000,'{source}','{receipt}');
insert into public.finance_effects(id,account_id,source_type,source_id,leg,amount_paise)
values ('{effect}','{source}','one_time_donation','{donation}',0,5000);
commit;
""")
        _, _, denial = race(
            correction(treasurer, effect, source, 4000, uuid.uuid4(), 2),
            correction(treasurer, effect, source, 3000, uuid.uuid4()),
            expected_right=3,
        )
        if "posting_already_corrected" not in denial:
            raise AssertionError(f"second correction failed for the wrong reason: {denial.strip()}")
        correction_result = require_sql(f"""
select (select count(*) from public.finance_corrections where original_effect_id='{effect}'),
       (select count(*) from public.finance_correction_receipts),
       (select sum(amount_paise::numeric) from public.finance_effects where account_id='{source}'),
       (select sum(amount_paise::numeric) from public.finance_effects where account_id='{target}');
""")
        if correction_result != "1|1|6000|18000":
            raise AssertionError(f"correction chain or balance mismatch: {correction_result}")
        receipt_state = require_sql(f"""
begin;
select set_config('request.jwt.claims','{{"sub":"{treasurer}","session_id":"{treasurer}","role":"authenticated"}}',true);
set local role authenticated;
select receipt_state from public.finance_receipt_state('{receipt}');
rollback;
""")
        if receipt_state.splitlines()[-1] != "superseded":
            raise AssertionError("original receipt was not superseded")
        print("competing corrections: one immutable revision, one denied; original receipt superseded")

        expense = str(uuid.uuid4())
        require_sql(f"""
begin;
insert into public.expense_requests(id,submit_operation_id,requester_id,requester_role,
 title,description,category,requested_amount_paise,bill_reference,status,
 decision_operation_id,decided_by,decided_at)
values ('{expense}','{uuid.uuid4()}','{treasurer}','treasurer','Synthetic repair',
 'Competing payment fixture','maintenance',5000,'synthetic bill','approved',
 '{uuid.uuid4()}','{president}',now());
commit;
""")
        _, _, denial = race(
            expense_payment(treasurer, expense, source, 4000, uuid.uuid4(), 2),
            expense_payment(treasurer, expense, source, 4000, uuid.uuid4()),
            expected_right=3,
        )
        if "expense_overpayment" not in denial:
            raise AssertionError(f"second expense payment failed for the wrong reason: {denial.strip()}")
        partial = require_sql(f"""
select (select status from public.expense_requests where id='{expense}'),
       app_private.expense_effective_paid('{expense}'),
       (select count(*) from public.expense_payments where expense_id='{expense}'),
       (select sum(amount_paise::numeric) from public.finance_effects where account_id='{source}');
""")
        if partial != "partially_paid|4000|1|2000":
            raise AssertionError(f"competing payments overpaid or misposted: {partial}")
        print("competing expense payments: one posted, one denied; 4,000 of 5,000 paise paid")

        payment_operation = str(uuid.uuid4())
        a, b, _ = race(
            expense_payment(treasurer, expense, source, 1000, payment_operation, 2),
            expense_payment(treasurer, expense, source, 1000, payment_operation),
        )
        ids_a = [line for line in a.splitlines() if line == line.strip() and len(line) == 36 and line.count("-") == 4]
        ids_b = [line for line in b.splitlines() if line == line.strip() and len(line) == 36 and line.count("-") == 4]
        if len(ids_a) != 1 or ids_a != ids_b:
            raise AssertionError("same-operation expense retries did not return one payment ID")
        paid = require_sql(f"""
select (select status from public.expense_requests where id='{expense}'),
       app_private.expense_effective_paid('{expense}'),
       (select count(*) from public.expense_payments where expense_id='{expense}'),
       (select count(*) from public.finance_effects where source_type='expense_payment'),
       (select sum(amount_paise::numeric) from public.finance_effects where account_id='{source}'),
       (select sum(amount_paise::numeric) from public.finance_effects where account_id='{target}');
""")
        if paid != "paid|5000|2|2|1000|18000":
            raise AssertionError(f"final expense payment reconciliation mismatch: {paid}")
        print("same-operation expense retry: one final payment and effect; paid total 5,000 paise")
    finally:
        reset = subprocess.run(["supabase", "db", "reset", "--local", "--no-seed"],
                               cwd=BACKEND, text=True, capture_output=True, check=False)
        if reset.returncode:
            print("WARNING: local reset failed; synthetic fixture rows may remain", file=sys.stderr)
            print(reset.stderr.strip(), file=sys.stderr)
            raise RuntimeError("local cleanup reset failed")
        print("fresh local database reset completed after race")


if __name__ == "__main__":
    main()
