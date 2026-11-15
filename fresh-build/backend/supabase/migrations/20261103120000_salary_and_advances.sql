-- Salary and advances (A-FIN4). Owner decision 3 November 2026: President or Treasurer
-- add staff and set salary amounts; only the Treasurer records payments.
-- An advance moves money into one reserved "Advances outstanding" account, so it is never
-- an expense until bills settle it, and that account's balance is the total still owed.
begin;
alter table public.masjid_accounts drop constraint masjid_accounts_kind_check;
alter table public.masjid_accounts add constraint masjid_accounts_kind_check
 check (kind in ('cash','upi','bank','advance'));
create unique index masjid_accounts_one_advance on public.masjid_accounts((kind)) where kind='advance';
insert into public.masjid_accounts(name,kind) values ('Advances outstanding','advance');

alter table public.finance_effects drop constraint finance_effects_source_kind_check;
alter table public.finance_effects drop constraint finance_effects_amount_leg_check;
alter table public.finance_effects add constraint finance_effects_source_kind_check
 check(source_type in ('account_opening','monthly_contribution','one_time_donation',
  'expense_payment','transfer','correction','salary_payment','advance_disbursement',
  'advance_return','advance_settlement'));
alter table public.finance_effects add constraint finance_effects_amount_leg_check
 check((source_type='account_opening' and leg=0 and amount_paise>=0)
  or (source_type in ('monthly_contribution','one_time_donation') and leg=0 and amount_paise>0)
  or (source_type in ('expense_payment','salary_payment','advance_settlement') and leg=0 and amount_paise<0)
  or (source_type in ('transfer','advance_disbursement','advance_return') and leg=1 and amount_paise<0)
  or (source_type in ('transfer','advance_disbursement','advance_return') and leg=2 and amount_paise>0)
  or (source_type='correction' and leg in (1,2) and amount_paise<>0));

-- No other workflow may touch the reserved account, whatever command it comes from.
create function app_private.guard_advance_account() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from public.masjid_accounts where id=new.account_id and kind='advance')
  and new.source_type not in ('advance_disbursement','advance_return','advance_settlement') then
  raise exception 'advance_account_reserved' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function app_private.guard_advance_account() from public,anon,authenticated;
create trigger finance_effects_advance_guard before insert on public.finance_effects
 for each row execute function app_private.guard_advance_account();

create or replace function public.list_active_masjid_accounts()
returns table(account_id uuid, account_name text, account_kind text)
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
 perform app_private.require_actor(array['treasurer']);
 return query select a.id,a.name,a.kind from public.masjid_accounts a
  where a.active and a.kind<>'advance' order by a.name,a.id;
end $$;

create table public.salary_staff (
 id uuid primary key default gen_random_uuid(),
 create_operation_id uuid not null unique,
 staff_name text not null check(length(btrim(staff_name)) between 1 and 120),
 staff_role text not null check(staff_role in ('hafiz','muezzin','other')),
 monthly_amount_paise bigint not null check(monthly_amount_paise>0),
 active boolean not null default true,
 created_by uuid not null references public.app_users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.salary_staff_changes (
 operation_id uuid primary key,
 staff_id uuid not null references public.salary_staff(id) on delete restrict,
 old_amount_paise bigint, new_amount_paise bigint not null,
 old_active boolean, new_active boolean not null,
 reason text not null,
 changed_by uuid not null references public.app_users(id) on delete restrict,
 changed_at timestamptz not null default now()
);
create table public.salary_payments (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null unique,
 staff_id uuid not null references public.salary_staff(id) on delete restrict,
 salary_month date not null check(extract(day from salary_month)=1),
 account_id uuid not null references public.masjid_accounts(id) on delete restrict,
 amount_paise bigint not null check(amount_paise>0),
 payment_method text not null check(payment_method in ('cash','upi','bank')),
 payment_date date not null,
 proof_reference text not null,
 posted_by uuid not null references public.app_users(id) on delete restrict,
 posted_at timestamptz not null default now(),
 unique(staff_id,salary_month)
);
create table public.advance_requests (
 id uuid primary key default gen_random_uuid(),
 submit_operation_id uuid not null unique,
 requested_by uuid not null references public.app_users(id) on delete restrict,
 recipient_name text not null check(length(btrim(recipient_name)) between 1 and 120),
 purpose text not null check(length(btrim(purpose)) between 3 and 500),
 amount_paise bigint not null check(amount_paise>0),
 status text not null default 'submitted'
  check(status in ('submitted','approved','rejected','paid','settled')),
 decision_operation_id uuid unique,
 decided_by uuid references public.app_users(id) on delete restrict,
 decided_at timestamptz,
 rejection_reason text,
 submitted_at timestamptz not null default now()
);
create table public.advance_payments (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null unique,
 advance_id uuid not null unique references public.advance_requests(id) on delete restrict,
 account_id uuid not null references public.masjid_accounts(id) on delete restrict,
 amount_paise bigint not null check(amount_paise>0),
 payment_date date not null,
 proof_reference text not null,
 posted_by uuid not null references public.app_users(id) on delete restrict,
 posted_at timestamptz not null default now()
);
create table public.advance_settlements (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null unique,
 advance_id uuid not null references public.advance_requests(id) on delete restrict,
 kind text not null check(kind in ('bill','return')),
 account_id uuid references public.masjid_accounts(id) on delete restrict,
 amount_paise bigint not null check(amount_paise>0),
 reference text not null,
 posted_by uuid not null references public.app_users(id) on delete restrict,
 posted_at timestamptz not null default now(),
 check((kind='return')=(account_id is not null))
);
-- Admin-flipped after the Board's recorded decision; until then only finance leaders see pay.
create table public.app_policy_flags (
 flag text primary key check(flag in ('salary_member_view')),
 enabled boolean not null,
 decision_reference text not null,
 set_at timestamptz not null default now()
);
do $$ declare v_name text; begin
 foreach v_name in array array['salary_staff','salary_staff_changes','salary_payments',
  'advance_requests','advance_payments','advance_settlements','app_policy_flags'] loop
  execute format('alter table public.%I enable row level security',v_name);
  execute format('revoke all on public.%I from public,anon,authenticated',v_name);
 end loop;
 foreach v_name in array array['salary_staff_changes','salary_payments','advance_payments',
  'advance_settlements'] loop
  execute format('create trigger %I before update or delete on public.%I for each row
   execute function app_private.reject_immutable_finance_change()',v_name||'_immutable',v_name);
 end loop;
end $$;

create function app_private.advance_account() returns uuid
language sql stable security definer set search_path=pg_catalog as $$
 select id from public.masjid_accounts where kind='advance' $$;
revoke all on function app_private.advance_account() from public,anon,authenticated;

create function app_private.payable_account(p_account_id uuid,p_amount bigint) returns text
language plpgsql security definer set search_path=pg_catalog as $$
declare v_kind text; v_balance numeric;
begin
 select kind into v_kind from public.masjid_accounts where id=p_account_id and active for update;
 if v_kind is null or v_kind='advance' or not exists(
  select 1 from public.account_openings where account_id=p_account_id and verified_by is not null) then
  raise exception 'verified_matching_account_required' using errcode='22023'; end if;
 select coalesce(sum(amount_paise::numeric),0) into v_balance
  from public.finance_effects where account_id=p_account_id;
 if v_balance<p_amount then
  raise exception 'insufficient_account_balance' using errcode='22023'; end if;
 return v_kind;
end $$;
revoke all on function app_private.payable_account(uuid,bigint) from public,anon,authenticated;

create function public.add_salary_staff(p_name text,p_role text,p_monthly_amount_paise bigint,
 p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','treasurer']);
 v_name text:=btrim(p_name); v_old public.salary_staff; v_id uuid;
begin
 if p_operation_id is null or length(v_name) not between 1 and 120
  or p_role not in ('hafiz','muezzin','other')
  or p_monthly_amount_paise is null or p_monthly_amount_paise<=0 then
  raise exception 'invalid_salary_staff' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,95));
 select * into v_old from public.salary_staff where create_operation_id=p_operation_id;
 if found then
  if v_old.created_by<>v_actor or v_old.staff_name<>v_name or v_old.staff_role<>p_role then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 insert into public.salary_staff(create_operation_id,staff_name,staff_role,monthly_amount_paise,created_by)
 values(p_operation_id,v_name,p_role,p_monthly_amount_paise,v_actor) returning id into v_id;
 insert into public.salary_staff_changes(operation_id,staff_id,new_amount_paise,new_active,reason,changed_by)
 values(p_operation_id,v_id,p_monthly_amount_paise,true,'Added',v_actor);
 return v_id;
end $$;

create function public.update_salary_staff(p_staff_id uuid,p_monthly_amount_paise bigint,
 p_active boolean,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','treasurer']);
 v_staff public.salary_staff; v_old public.salary_staff_changes; v_reason text:=btrim(p_reason);
begin
 if p_operation_id is null or p_staff_id is null or p_active is null
  or p_monthly_amount_paise is null or p_monthly_amount_paise<=0
  or length(v_reason) not between 3 and 240 then
  raise exception 'invalid_salary_staff' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,95));
 select * into v_old from public.salary_staff_changes where operation_id=p_operation_id;
 if found then
  if v_old.changed_by<>v_actor or v_old.staff_id<>p_staff_id
   or v_old.new_amount_paise<>p_monthly_amount_paise or v_old.new_active<>p_active then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return p_staff_id;
 end if;
 select * into v_staff from public.salary_staff where id=p_staff_id for update;
 if not found then raise exception 'salary_staff_not_found' using errcode='22023'; end if;
 if v_staff.monthly_amount_paise=p_monthly_amount_paise and v_staff.active=p_active then
  raise exception 'salary_staff_unchanged' using errcode='22023'; end if;
 insert into public.salary_staff_changes(operation_id,staff_id,old_amount_paise,new_amount_paise,
  old_active,new_active,reason,changed_by)
 values(p_operation_id,p_staff_id,v_staff.monthly_amount_paise,p_monthly_amount_paise,
  v_staff.active,p_active,v_reason,v_actor);
 update public.salary_staff set monthly_amount_paise=p_monthly_amount_paise,active=p_active
  where id=p_staff_id;
 return p_staff_id;
end $$;

create function public.record_salary_payment(p_staff_id uuid,p_month date,p_account_id uuid,
 p_amount_paise bigint,p_date date,p_proof text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
 v_old public.salary_payments; v_kind text; v_id uuid; v_proof text:=btrim(p_proof);
begin
 if p_operation_id is null or p_staff_id is null or p_account_id is null or p_month is null
  or extract(day from p_month)<>1 or p_amount_paise is null or p_amount_paise<=0
  or p_date is null or p_date>(now() at time zone 'Asia/Kolkata')::date
  or length(v_proof) not between 3 and 240 then
  raise exception 'invalid_salary_payment' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,96));
 select * into v_old from public.salary_payments where operation_id=p_operation_id;
 if found then
  if v_old.posted_by<>v_actor or v_old.staff_id<>p_staff_id or v_old.salary_month<>p_month
   or v_old.account_id<>p_account_id or v_old.amount_paise<>p_amount_paise
   or v_old.payment_date<>p_date or v_old.proof_reference<>v_proof then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 if not exists(select 1 from public.salary_staff where id=p_staff_id and active) then
  raise exception 'salary_staff_not_found' using errcode='22023'; end if;
 if exists(select 1 from public.salary_payments where staff_id=p_staff_id and salary_month=p_month) then
  raise exception 'salary_already_paid' using errcode='23505'; end if;
 v_kind:=app_private.payable_account(p_account_id,p_amount_paise);
 insert into public.salary_payments(operation_id,staff_id,salary_month,account_id,amount_paise,
  payment_method,payment_date,proof_reference,posted_by)
 values(p_operation_id,p_staff_id,p_month,p_account_id,p_amount_paise,v_kind,p_date,v_proof,v_actor)
 returning id into v_id;
 insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
 values(p_account_id,'salary_payment',v_id,0,-p_amount_paise);
 return v_id;
end $$;

-- Member projection: name, role, month, amount, paid state/date/method. No account or proof.
create function public.list_salary_records(p_month date)
returns table(staff_id uuid,staff_name text,staff_role text,active boolean,
 monthly_amount_paise text,paid_amount_paise text,payment_date date,payment_method text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
  'secretary','treasurer','committee_member','member','data_entry']);
begin
 if p_month is null or extract(day from p_month)<>1 then
  raise exception 'invalid_salary_month' using errcode='22023'; end if;
 if not exists(select 1 from public.app_users u where u.id=v_actor and u.role in
   ('system_admin','president','vice_president','secretary','treasurer'))
  and not exists(select 1 from public.app_policy_flags where flag='salary_member_view' and enabled) then
  raise exception 'salary_view_not_approved' using errcode='42501'; end if;
 return query select s.id,s.staff_name,s.staff_role,s.active,s.monthly_amount_paise::text,
  p.amount_paise::text,p.payment_date,p.payment_method
  from public.salary_staff s
  left join public.salary_payments p on p.staff_id=s.id and p.salary_month=p_month
  where s.active or p.id is not null
  order by s.staff_name,s.id;
end $$;

create function public.submit_advance_request(p_recipient text,p_purpose text,p_amount_paise bigint,
 p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary',
  'treasurer','committee_member','member']);
 v_recipient text:=btrim(p_recipient); v_purpose text:=btrim(p_purpose);
 v_old public.advance_requests; v_id uuid;
begin
 if p_operation_id is null or length(v_recipient) not between 1 and 120
  or length(v_purpose) not between 3 and 500 or p_amount_paise is null or p_amount_paise<=0 then
  raise exception 'invalid_advance' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,97));
 select * into v_old from public.advance_requests where submit_operation_id=p_operation_id;
 if found then
  if v_old.requested_by<>v_actor or v_old.recipient_name<>v_recipient
   or v_old.purpose<>v_purpose or v_old.amount_paise<>p_amount_paise then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 insert into public.advance_requests(submit_operation_id,requested_by,recipient_name,purpose,amount_paise)
 values(p_operation_id,v_actor,v_recipient,v_purpose,p_amount_paise) returning id into v_id;
 return v_id;
end $$;

create function public.decide_advance_request(p_id uuid,p_decision text,p_reason text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president']);
 v_request public.advance_requests; v_reason text:=nullif(btrim(p_reason),'');
begin
 if p_operation_id is null or p_decision not in ('approve','reject')
  or (p_decision='reject' and (v_reason is null or length(v_reason) not between 3 and 500))
  or (p_decision='approve' and v_reason is not null) then
  raise exception 'invalid_advance_decision' using errcode='22023'; end if;
 select * into v_request from public.advance_requests where id=p_id for update;
 if not found then raise exception 'advance_not_found' using errcode='22023'; end if;
 if v_request.decision_operation_id=p_operation_id then
  -- A rejection always keeps its reason, so the reason tells the two decisions apart.
  if v_request.decided_by<>v_actor
   or (p_decision='approve')<>(v_request.rejection_reason is null) then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return p_id;
 end if;
 if v_request.requested_by=v_actor then
  raise exception 'wrong_advance_approver' using errcode='42501'; end if;
 if v_request.status<>'submitted' then
  raise exception 'advance_not_decidable' using errcode='22023'; end if;
 update public.advance_requests set status=case when p_decision='approve' then 'approved' else 'rejected' end,
  decision_operation_id=p_operation_id,decided_by=v_actor,decided_at=now(),rejection_reason=v_reason
  where id=p_id;
 return p_id;
end $$;

create function public.pay_advance(p_id uuid,p_account_id uuid,p_date date,p_proof text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
 v_request public.advance_requests; v_old public.advance_payments; v_id uuid; v_proof text:=btrim(p_proof);
begin
 if p_operation_id is null or p_id is null or p_account_id is null or p_date is null
  or p_date>(now() at time zone 'Asia/Kolkata')::date or length(v_proof) not between 3 and 240 then
  raise exception 'invalid_advance_payment' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,98));
 select * into v_old from public.advance_payments where operation_id=p_operation_id;
 if found then
  if v_old.posted_by<>v_actor or v_old.advance_id<>p_id or v_old.account_id<>p_account_id
   or v_old.payment_date<>p_date or v_old.proof_reference<>v_proof then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 select * into v_request from public.advance_requests where id=p_id for update;
 if not found or v_request.status<>'approved' then
  raise exception 'advance_not_approved' using errcode='22023'; end if;
 perform app_private.payable_account(p_account_id,v_request.amount_paise);
 insert into public.advance_payments(operation_id,advance_id,account_id,amount_paise,payment_date,
  proof_reference,posted_by)
 values(p_operation_id,p_id,p_account_id,v_request.amount_paise,p_date,v_proof,v_actor)
 returning id into v_id;
 insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise) values
  (p_account_id,'advance_disbursement',v_id,1,-v_request.amount_paise),
  (app_private.advance_account(),'advance_disbursement',v_id,2,v_request.amount_paise);
 update public.advance_requests set status='paid' where id=p_id;
 return v_id;
end $$;

create function app_private.advance_outstanding(p_id uuid) returns bigint
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce((select amount_paise from public.advance_payments where advance_id=p_id),0)
  -coalesce((select sum(amount_paise) from public.advance_settlements where advance_id=p_id),0) $$;
revoke all on function app_private.advance_outstanding(uuid) from public,anon,authenticated;

create function public.settle_advance(p_id uuid,p_kind text,p_amount_paise bigint,p_account_id uuid,
 p_reference text,p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['treasurer']);
 v_request public.advance_requests; v_old public.advance_settlements; v_id uuid;
 v_reference text:=btrim(p_reference); v_outstanding bigint;
begin
 if p_operation_id is null or p_id is null or p_kind not in ('bill','return')
  or p_amount_paise is null or p_amount_paise<=0 or length(v_reference) not between 3 and 240
  or ((p_kind='return')<>(p_account_id is not null)) then
  raise exception 'invalid_advance_settlement' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,99));
 select * into v_old from public.advance_settlements where operation_id=p_operation_id;
 if found then
  if v_old.posted_by<>v_actor or v_old.advance_id<>p_id or v_old.kind<>p_kind
   or v_old.amount_paise<>p_amount_paise or v_old.account_id is distinct from p_account_id
   or v_old.reference<>v_reference then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_old.id;
 end if;
 select * into v_request from public.advance_requests where id=p_id for update;
 if not found or v_request.status<>'paid' then
  raise exception 'advance_not_outstanding' using errcode='22023'; end if;
 v_outstanding:=app_private.advance_outstanding(p_id);
 if p_amount_paise>v_outstanding then
  raise exception 'advance_oversettled' using errcode='22023'; end if;
 if p_kind='return' and not exists(select 1 from public.masjid_accounts
   where id=p_account_id and active and kind<>'advance') then
  raise exception 'verified_matching_account_required' using errcode='22023'; end if;
 insert into public.advance_settlements(operation_id,advance_id,kind,account_id,amount_paise,reference,posted_by)
 values(p_operation_id,p_id,p_kind,p_account_id,p_amount_paise,v_reference,v_actor) returning id into v_id;
 if p_kind='bill' then
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise)
  values(app_private.advance_account(),'advance_settlement',v_id,0,-p_amount_paise);
 else
  insert into public.finance_effects(account_id,source_type,source_id,leg,amount_paise) values
   (app_private.advance_account(),'advance_return',v_id,1,-p_amount_paise),
   (p_account_id,'advance_return',v_id,2,p_amount_paise);
 end if;
 if p_amount_paise=v_outstanding then
  update public.advance_requests set status='settled' where id=p_id; end if;
 return v_id;
end $$;

create function public.list_advances()
returns table(advance_id uuid,recipient_name text,purpose text,amount_paise text,status text,
 requested_by_username text,is_mine boolean,outstanding_paise text,bills_paise text,
 returned_paise text,rejection_reason text,submitted_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['system_admin','president','vice_president',
  'secretary','treasurer','committee_member','member']);
 v_leader boolean;
begin
 select u.role in ('system_admin','president','vice_president','secretary','treasurer')
  into v_leader from public.app_users u where u.id=v_actor;
 return query select r.id,r.recipient_name,r.purpose,r.amount_paise::text,r.status,al.username,
  r.requested_by=v_actor,app_private.advance_outstanding(r.id)::text,
  coalesce((select sum(s.amount_paise) from public.advance_settlements s
   where s.advance_id=r.id and s.kind='bill'),0)::text,
  coalesce((select sum(s.amount_paise) from public.advance_settlements s
   where s.advance_id=r.id and s.kind='return'),0)::text,
  r.rejection_reason,r.submitted_at
  from public.advance_requests r
  join app_private.username_aliases al on al.user_id=r.requested_by
  where v_leader or r.requested_by=v_actor
  order by r.submitted_at desc,r.id desc;
end $$;


create or replace function public.list_finance_report_lines(p_run_id uuid)
returns table(effect_id uuid,account_id uuid,source_type text,source_id uuid,leg smallint,
 category text,amount_paise text,occurred_at timestamptz,description text,
 proof_reference text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select e.id,e.account_id,e.source_type,e.source_id,e.leg,
  case when e.source_type='account_opening' then 'opening'
   when e.source_type in ('transfer','advance_disbursement','advance_return') then 'transfer'
   when coalesce(c.source_kind,e.source_type) in ('expense_payment','salary_payment','advance_settlement') then 'expense'
   else 'income' end,e.amount_paise::text,e.occurred_at,
  case when c.id is not null then 'Correction: '||c.reason
   when e.source_type='monthly_contribution' then d.name
   when e.source_type='one_time_donation' then od.donor_name
   when e.source_type='expense_payment' then er.title
   when e.source_type='transfer' then 'Account transfer'
   when e.source_type='salary_payment' then 'Salary: '||ss.staff_name||' · '||to_char(sp.salary_month,'Mon YYYY')
   when e.source_type='advance_disbursement' then 'Advance paid: '||ar.recipient_name
   when e.source_type='advance_return' then 'Advance returned: '||ar2.recipient_name
   when e.source_type='advance_settlement' then 'Advance bills: '||ar2.recipient_name
   else 'Opening balance' end,
  case when v_run.include_proofs and e.source_type='expense_payment'
   then ep.proof_reference else null::text end
 from public.finance_report_effects snapshot
 join public.finance_effects e on e.id=snapshot.effect_id
 left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id
 left join public.ledger_entries le on e.source_type='monthly_contribution' and le.id=e.source_id
 left join public.payment_claims pc on pc.id=le.source_id
 left join public.monthly_donors d on d.id=pc.donor_id
 left join public.one_time_donations od on e.source_type='one_time_donation' and od.id=e.source_id
 left join public.expense_payments ep on e.source_type='expense_payment' and ep.id=e.source_id
 left join public.expense_requests er on er.id=ep.expense_id
 left join public.salary_payments sp on e.source_type='salary_payment' and sp.id=e.source_id
 left join public.salary_staff ss on ss.id=sp.staff_id
 left join public.advance_payments ap on e.source_type='advance_disbursement' and ap.id=e.source_id
 left join public.advance_requests ar on ar.id=ap.advance_id
 left join public.advance_settlements ast on e.source_type in ('advance_return','advance_settlement') and ast.id=e.source_id
 left join public.advance_requests ar2 on ar2.id=ast.advance_id
 where snapshot.run_id=p_run_id
  and (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
  and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
 order by e.occurred_at,e.id;
end $$;

create or replace function public.worker_finance_report_lines(p_run_id uuid)
returns table(effect_id uuid,account_id uuid,source_type text,source_id uuid,leg smallint,
 category text,amount_paise text,occurred_at timestamptz,description text,proof_reference text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select e.id,e.account_id,e.source_type,e.source_id,e.leg,
  case when e.source_type='account_opening' then 'opening'
   when e.source_type in ('transfer','advance_disbursement','advance_return') then 'transfer'
   when coalesce(c.source_kind,e.source_type) in ('expense_payment','salary_payment','advance_settlement') then 'expense'
   else 'income' end,e.amount_paise::text,e.occurred_at,
  case when c.id is not null then 'Correction: '||c.reason
   when e.source_type='monthly_contribution' then d.name
   when e.source_type='one_time_donation' then od.donor_name
   when e.source_type='expense_payment' then er.title
   when e.source_type='transfer' then 'Account transfer'
   when e.source_type='salary_payment' then 'Salary: '||ss.staff_name||' · '||to_char(sp.salary_month,'Mon YYYY')
   when e.source_type='advance_disbursement' then 'Advance paid: '||ar.recipient_name
   when e.source_type='advance_return' then 'Advance returned: '||ar2.recipient_name
   when e.source_type='advance_settlement' then 'Advance bills: '||ar2.recipient_name
   else 'Opening balance' end,
  case when v_run.include_proofs and e.source_type='expense_payment'
   then ep.proof_reference else null::text end
 from public.finance_report_effects snapshot
 join public.finance_effects e on e.id=snapshot.effect_id
 left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id
 left join public.ledger_entries le on e.source_type='monthly_contribution' and le.id=e.source_id
 left join public.payment_claims pc on pc.id=le.source_id
 left join public.monthly_donors d on d.id=pc.donor_id
 left join public.one_time_donations od on e.source_type='one_time_donation' and od.id=e.source_id
 left join public.expense_payments ep on e.source_type='expense_payment' and ep.id=e.source_id
 left join public.expense_requests er on er.id=ep.expense_id
 left join public.salary_payments sp on e.source_type='salary_payment' and sp.id=e.source_id
 left join public.salary_staff ss on ss.id=sp.staff_id
 left join public.advance_payments ap on e.source_type='advance_disbursement' and ap.id=e.source_id
 left join public.advance_requests ar on ar.id=ap.advance_id
 left join public.advance_settlements ast on e.source_type in ('advance_return','advance_settlement') and ast.id=e.source_id
 left join public.advance_requests ar2 on ar2.id=ast.advance_id
 where snapshot.run_id=p_run_id
  and (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
  and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
 order by e.occurred_at,e.id;
end $$;

create or replace function public.list_finance_report_balances(p_run_id uuid)
returns table(account_id uuid,account_name text,opening_paise text,period_openings_paise text,income_paise text,
 expense_paise text,transfer_paise text,closing_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 perform app_private.require_actor(array['system_admin','president','vice_president','secretary','treasurer']);
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select a.account_id,a.account_name,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.start_date),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='account_opening'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type) in ('monthly_contribution','one_time_donation')),0)::text,
  coalesce(sum(-(e.amount_paise::numeric)) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type) in ('expense_payment','salary_payment','advance_settlement')),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type in ('transfer','advance_disbursement','advance_return')),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date),0)::text
 from public.finance_report_accounts a
 left join (public.finance_report_effects snapshot
  join public.finance_effects e on e.id=snapshot.effect_id and snapshot.run_id=p_run_id
  left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id)
  on e.account_id=a.account_id
 where a.run_id=p_run_id
 group by a.account_id,a.account_name order by a.account_name,a.account_id;
end $$;

create or replace function public.worker_finance_report_balances(p_run_id uuid)
returns table(account_id uuid,account_name text,opening_paise text,period_openings_paise text,
 income_paise text,expense_paise text,transfer_paise text,closing_paise text)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_run public.finance_report_runs;
begin
 select * into v_run from public.finance_report_runs where id=p_run_id;
 if not found then raise exception 'report_not_found' using errcode='22023'; end if;
 return query select a.account_id,a.account_name,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.start_date),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type='account_opening'),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type) in ('monthly_contribution','one_time_donation')),0)::text,
  coalesce(sum(-(e.amount_paise::numeric)) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and coalesce(c.source_kind,e.source_type) in ('expense_payment','salary_payment','advance_settlement')),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date>=v_run.start_date
   and (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date
   and e.source_type in ('transfer','advance_disbursement','advance_return')),0)::text,
  coalesce(sum(e.amount_paise::numeric) filter (where
   (e.occurred_at at time zone 'Asia/Kolkata')::date<v_run.end_exclusive_date),0)::text
 from public.finance_report_accounts a
 left join (public.finance_report_effects snapshot
  join public.finance_effects e on e.id=snapshot.effect_id and snapshot.run_id=p_run_id
  left join public.finance_corrections c on e.source_type='correction' and c.id=e.source_id)
  on e.account_id=a.account_id
 where a.run_id=p_run_id
 group by a.account_id,a.account_name order by a.account_name,a.account_id;
end $$;

do $$ declare v_signature text; begin
 foreach v_signature in array array['add_salary_staff(text,text,bigint,uuid)',
  'update_salary_staff(uuid,bigint,boolean,text,uuid)',
  'record_salary_payment(uuid,date,uuid,bigint,date,text,uuid)',
  'list_salary_records(date)',
  'submit_advance_request(text,text,bigint,uuid)',
  'decide_advance_request(uuid,text,text,uuid)',
  'pay_advance(uuid,uuid,date,text,uuid)',
  'settle_advance(uuid,text,bigint,uuid,text,uuid)',
  'list_advances()'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',v_signature);
  execute format('grant execute on function public.%s to authenticated',v_signature);
 end loop;
end $$;
commit;
