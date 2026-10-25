-- Staff-attested manual receipt handoff. Disabled until Board policy and the
-- approved rendered receipt are ready. This function never sends a message.
begin;

create table app_private.receipt_handoff_policy (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  decision_reference text,
  check (not enabled or length(btrim(decision_reference)) between 3 and 240)
);
insert into app_private.receipt_handoff_policy(id,enabled) values(true,false);
alter table app_private.receipt_handoff_policy enable row level security;
revoke all on app_private.receipt_handoff_policy from public,anon,authenticated;

create table public.receipt_handoff_events (
  operation_id uuid primary key,
  receipt_code text not null check (
    receipt_code ~ '^MEM2-R-[0-9A-F]{32}$' or
    receipt_code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  amount_paise bigint not null check (amount_paise>0),
  actor_id uuid not null references public.app_users(id) on delete restrict,
  recipient_reference text not null check (length(btrim(recipient_reference)) between 3 and 120),
  channel text not null check (channel in ('in_person','email','other_manual')),
  result text not null check (result in ('delivered','failed','uncertain')),
  evidence_reference text not null check (length(btrim(evidence_reference)) between 3 and 240),
  recorded_at timestamptz not null default clock_timestamp()
);
create index receipt_handoff_events_code_time
  on public.receipt_handoff_events(receipt_code,recorded_at,operation_id);
create trigger receipt_handoff_events_immutable before update or delete
  on public.receipt_handoff_events for each row
  execute function app_private.reject_immutable_finance_change();
alter table public.receipt_handoff_events enable row level security;
revoke all on public.receipt_handoff_events from public,anon,authenticated;

create function public.record_manual_receipt_handoff(
  p_operation_id uuid,p_receipt_code text,p_recipient_reference text,
  p_channel text,p_result text,p_evidence_reference text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_actor uuid:=app_private.require_actor(array[
    'president','vice_president','secretary','treasurer','committee_member']);
  v_existing public.receipt_handoff_events;
  v_amount bigint;
  v_recipient text:=btrim(p_recipient_reference);
  v_evidence text:=btrim(p_evidence_reference);
begin
  if not exists(select 1 from app_private.receipt_handoff_policy
    where id and enabled and decision_reference is not null) then
    raise exception 'receipt_handoff_not_approved' using errcode='42501'; end if;
  if p_operation_id is null or p_receipt_code is null or p_channel is null
    or p_result is null or v_recipient is null or length(v_recipient) not between 3 and 120
    or v_evidence is null or length(v_evidence) not between 3 and 240
    or p_channel not in ('in_person','email','other_manual')
    or p_result not in ('delivered','failed','uncertain') then
    raise exception 'invalid_receipt_handoff' using errcode='22023'; end if;
  -- Same operation is a read-only retry even if the receipt was corrected later.
  select * into v_existing from public.receipt_handoff_events
    where operation_id=p_operation_id for update;
  if found then
    if v_existing.actor_id<>v_actor or v_existing.receipt_code<>p_receipt_code
      or v_existing.recipient_reference<>v_recipient or v_existing.channel<>p_channel
      or v_existing.result<>p_result or v_existing.evidence_reference<>v_evidence then
      raise exception 'receipt_handoff_operation_conflict' using errcode='23505'; end if;
    return v_existing.operation_id;
  end if;
  select amount_paise::bigint into v_amount
    from public.lookup_active_receipt(p_receipt_code);
  if v_amount is null then
    raise exception 'receipt_not_current' using errcode='22023'; end if;
  insert into public.receipt_handoff_events(operation_id,receipt_code,amount_paise,
    actor_id,recipient_reference,channel,result,evidence_reference)
  values(p_operation_id,p_receipt_code,v_amount,v_actor,v_recipient,p_channel,p_result,v_evidence)
  on conflict(operation_id) do nothing;
  select * into v_existing from public.receipt_handoff_events
    where operation_id=p_operation_id for update;
  if v_existing.actor_id<>v_actor or v_existing.receipt_code<>p_receipt_code
    or v_existing.recipient_reference<>v_recipient or v_existing.channel<>p_channel
    or v_existing.result<>p_result or v_existing.evidence_reference<>v_evidence
    or v_existing.amount_paise<>v_amount then
    raise exception 'receipt_handoff_operation_conflict' using errcode='23505'; end if;
  return v_existing.operation_id;
end $$;
revoke all on function public.record_manual_receipt_handoff(uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.record_manual_receipt_handoff(uuid,text,text,text,text,text)
  to authenticated;

commit;
