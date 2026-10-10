create table private.mobile_api_rate_limit_counters (
  bucket text not null,
  subject_hash text not null,
  window_started_at timestamp with time zone not null,
  request_count integer not null,
  updated_at timestamp with time zone not null default clock_timestamp(),

  constraint mobile_api_rate_limit_counters_pkey
    primary key (bucket, subject_hash),

  constraint mobile_api_rate_limit_counters_bucket_chk
    check (
      length(bucket) between 1 and 100
    ),

  constraint mobile_api_rate_limit_counters_subject_hash_chk
    check (
      subject_hash ~ '^[0-9a-f]{64}$'
    ),

  constraint mobile_api_rate_limit_counters_request_count_chk
    check (
      request_count >= 0
    )
);

alter table private.mobile_api_rate_limit_counters
  enable row level security;

revoke all
on table private.mobile_api_rate_limit_counters
from public, anon, authenticated, service_role;

comment on table private.mobile_api_rate_limit_counters is
  'Server-only distributed fixed-window counters for mobile API abuse protection. Subjects are SHA-256 hashes; raw network identifiers are not stored.';

create or replace function public.consume_mobile_api_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_bucket text := nullif(btrim(p_bucket), '');
  v_subject_hash text := lower(nullif(btrim(p_subject_hash), ''));
  v_now timestamp with time zone := clock_timestamp();
  v_window_started_at timestamp with time zone;
  v_request_count integer;
  v_retry_after integer;
begin
  if v_bucket is null
     or length(v_bucket) > 100 then
    raise exception 'invalid_rate_limit_bucket'
      using errcode = '22023';
  end if;

  if v_subject_hash is null
     or v_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_rate_limit_subject'
      using errcode = '22023';
  end if;

  if p_limit is null
     or p_limit < 1
     or p_limit > 10000 then
    raise exception 'invalid_rate_limit_limit'
      using errcode = '22023';
  end if;

  if p_window_seconds is null
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_window'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'mobile-api-rate-limit:'
      || v_bucket
      || ':'
      || v_subject_hash,
      0
    )
  );

  select
    c.window_started_at,
    c.request_count
  into
    v_window_started_at,
    v_request_count
  from private.mobile_api_rate_limit_counters c
  where c.bucket = v_bucket
    and c.subject_hash = v_subject_hash
  for update;

  if not found
     or v_now >= (
       v_window_started_at
       + pg_catalog.make_interval(
         secs => p_window_seconds
       )
     ) then

    insert into private.mobile_api_rate_limit_counters (
      bucket,
      subject_hash,
      window_started_at,
      request_count,
      updated_at
    )
    values (
      v_bucket,
      v_subject_hash,
      v_now,
      1,
      v_now
    )
    on conflict (bucket, subject_hash)
    do update
    set
      window_started_at = excluded.window_started_at,
      request_count = 1,
      updated_at = excluded.updated_at;

    return query
    select
      true,
      greatest(p_limit - 1, 0),
      0;

    return;
  end if;

  if v_request_count >= p_limit then
    v_retry_after :=
      greatest(
        1,
        ceil(
          extract(
            epoch from (
              v_window_started_at
              + pg_catalog.make_interval(
                secs => p_window_seconds
              )
              - v_now
            )
          )
        )::integer
      );

    update private.mobile_api_rate_limit_counters
    set updated_at = v_now
    where bucket = v_bucket
      and subject_hash = v_subject_hash;

    return query
    select
      false,
      0,
      v_retry_after;

    return;
  end if;

  update private.mobile_api_rate_limit_counters
  set
    request_count = request_count + 1,
    updated_at = v_now
  where bucket = v_bucket
    and subject_hash = v_subject_hash;

  return query
  select
    true,
    greatest(
      p_limit - (v_request_count + 1),
      0
    ),
    0;
end;
$$;

revoke all
on function public.consume_mobile_api_rate_limit(
  text,
  text,
  integer,
  integer
)
from public, anon, authenticated;

grant execute
on function public.consume_mobile_api_rate_limit(
  text,
  text,
  integer,
  integer
)
to service_role;

comment on function public.consume_mobile_api_rate_limit(
  text,
  text,
  integer,
  integer
) is
  'Atomically consumes one server-side mobile API rate-limit token. Callable only through the service role.';
