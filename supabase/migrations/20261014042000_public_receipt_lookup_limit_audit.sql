-- Distributed, fail-closed limits and a hashed access trail for the public lookup.
begin;

create table private.public_receipt_lookup_attempts (
  id bigint generated always as identity primary key,
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  allowed boolean not null,
  created_at timestamptz not null default clock_timestamp()
);
create index public_receipt_lookup_attempts_created_idx
  on private.public_receipt_lookup_attempts (created_at);
alter table private.public_receipt_lookup_attempts enable row level security;
revoke all on private.public_receipt_lookup_attempts from public,anon,authenticated,service_role;

create function public.consume_public_receipt_lookup(
  p_subject_hash text,p_receipt_hash text
) returns table (allowed boolean,retry_after_seconds integer)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
  v_global record;
  v_network record;
  v_allowed boolean;
  v_retry integer;
begin
  if p_subject_hash is null or p_subject_hash !~ '^[0-9a-f]{64}$'
     or p_receipt_hash is null or p_receipt_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_lookup_subject' using errcode='22023'; end if;
  select * into v_global from public.consume_mobile_api_rate_limit(
    'public:receipt-lookup:global',repeat('0',64),300,300);
  if v_global.allowed then
    select * into v_network from public.consume_mobile_api_rate_limit(
      'public:receipt-lookup:network',p_subject_hash,5,300);
    v_allowed := v_network.allowed;
    v_retry := v_network.retry_after_seconds;
  else
    v_allowed := false;
    v_retry := v_global.retry_after_seconds;
  end if;
  insert into private.public_receipt_lookup_attempts(subject_hash,receipt_hash,allowed)
    values (p_subject_hash,p_receipt_hash,v_allowed);
  return query select v_allowed,v_retry;
end;
$$;
revoke all on function public.consume_public_receipt_lookup(text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.consume_public_receipt_lookup(text,text) to service_role;

commit;
