-- A named cash donation entered directly by the Treasurer is one atomic
-- submit/verify operation. Aggregate collection-task counts use a separate path.
begin;

create table public.direct_cash_posts (
  operation_id uuid primary key,
  donation_id uuid not null unique references public.one_time_donations(id) on delete restrict,
  posted_by uuid not null references public.app_users(id) on delete restrict,
  evidence_key text not null unique check (length(evidence_key) between 3 and 240),
  posted_at timestamptz not null default now()
);
alter table public.direct_cash_posts enable row level security;
revoke all on public.direct_cash_posts from public, anon, authenticated;
create trigger direct_cash_posts_immutable before update or delete on public.direct_cash_posts
  for each row execute function app_private.reject_immutable_finance_change();

create function public.post_direct_treasurer_cash(
  p_name text, p_kind text, p_referrer_id uuid, p_date date,
  p_amount_paise bigint, p_evidence text, p_account_id uuid, p_operation_id uuid)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor uuid := app_private.require_actor(array['treasurer']);
  v_post public.direct_cash_posts;
  v_donation_id uuid;
begin
  if p_operation_id is null then
    raise exception 'invalid_direct_cash' using errcode='22023';
  end if;
  -- Use the same lock as submit_one_time_donation. A normal pending
  -- submission cannot be silently converted into a direct post on replay.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,61));
  select * into v_post from public.direct_cash_posts where operation_id=p_operation_id;
  if found then
    if v_post.posted_by<>v_actor then
      raise exception 'operation_id_conflict' using errcode='23505';
    end if;
  elsif exists(select 1 from public.one_time_donations
      where submit_operation_id=p_operation_id) then
    raise exception 'operation_id_conflict' using errcode='23505';
  end if;

  v_donation_id := public.submit_one_time_donation(
    p_name,p_kind,p_referrer_id,p_date,'cash',p_amount_paise,p_evidence,p_operation_id);
  perform public.decide_one_time_donation(
    v_donation_id,'verify',p_amount_paise,p_account_id,null,p_operation_id);
  if v_post.operation_id is null then
    insert into public.direct_cash_posts(operation_id,donation_id,posted_by,evidence_key)
    values(p_operation_id,v_donation_id,v_actor,lower(btrim(p_evidence)));
  elsif v_post.donation_id<>v_donation_id then
    raise exception 'operation_id_conflict' using errcode='23505';
  end if;
  return v_donation_id;
end $$;
revoke all on function public.post_direct_treasurer_cash(text,text,uuid,date,bigint,text,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.post_direct_treasurer_cash(text,text,uuid,date,bigint,text,uuid,uuid)
  to authenticated;

commit;
