-- Durable shared limiter for trusted identity routes, unavailable by default
-- unless the server has a service credential. No client grants.
begin;
create table app_private.identity_rate_buckets (
 bucket_hash text primary key check(bucket_hash ~ '^[0-9a-f]{64}$'),
 window_started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 10000)
);
alter table app_private.identity_rate_buckets enable row level security;
revoke all on app_private.identity_rate_buckets from public,anon,authenticated;

create function public.consume_identity_rate_limit(p_hash text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_attempts integer;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
  or p_limit is null or p_limit not between 1 and 1000
  or p_window_seconds is null or p_window_seconds not between 10 and 86400 then
  raise exception 'invalid_rate_limit' using errcode='22023'; end if;
 insert into app_private.identity_rate_buckets(bucket_hash,window_started_at,attempts)
 values(p_hash,now(),1)
 on conflict(bucket_hash) do update set
  window_started_at=case when app_private.identity_rate_buckets.window_started_at
     <=now()-make_interval(secs=>p_window_seconds) then now()
     else app_private.identity_rate_buckets.window_started_at end,
  attempts=case when app_private.identity_rate_buckets.window_started_at
     <=now()-make_interval(secs=>p_window_seconds) then 1
     else least(app_private.identity_rate_buckets.attempts+1,10000) end
 returning attempts into v_attempts;
 return v_attempts<=p_limit;
end $$;
revoke all on function public.consume_identity_rate_limit(text,integer,integer)
 from public,anon,authenticated;
grant execute on function public.consume_identity_rate_limit(text,integer,integer) to service_role;
commit;
