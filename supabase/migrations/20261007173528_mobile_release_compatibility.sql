-- Masjid-e-Mamoor 2
-- Phase 7A2A: public mobile release compatibility policy.

begin;

create table public.mobile_release_policies (
  platform text primary key,
  latest_version text not null,
  minimum_supported_version text not null,
  store_url text,
  update_message text,
  updated_at timestamptz not null default now(),

  constraint mobile_release_policies_platform_chk
    check (platform in ('android', 'ios')),

  constraint mobile_release_policies_latest_version_chk
    check (
      latest_version ~
      '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$'
    ),

  constraint mobile_release_policies_minimum_version_chk
    check (
      minimum_supported_version ~
      '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$'
    ),

  constraint mobile_release_policies_version_order_chk
    check (
      array[
        split_part(minimum_supported_version, '.', 1)::bigint,
        split_part(minimum_supported_version, '.', 2)::bigint,
        split_part(minimum_supported_version, '.', 3)::bigint
      ] <=
      array[
        split_part(latest_version, '.', 1)::bigint,
        split_part(latest_version, '.', 2)::bigint,
        split_part(latest_version, '.', 3)::bigint
      ]
    ),

  constraint mobile_release_policies_store_url_chk
    check (
      store_url is null
      or (
        store_url = btrim(store_url)
        and length(store_url) between 1 and 500
        and store_url like 'https://%'
      )
    ),

  constraint mobile_release_policies_update_message_chk
    check (
      update_message is null
      or (
        update_message = btrim(update_message)
        and length(update_message) between 1 and 500
      )
    )
);

create trigger mobile_release_policies_set_updated_at
before update on public.mobile_release_policies
for each row execute function public.set_updated_at();

alter table public.mobile_release_policies enable row level security;

create policy mobile_release_policies_public_read
on public.mobile_release_policies
for select
to anon, authenticated
using (true);

revoke all privileges on table public.mobile_release_policies
from public, anon, authenticated;

grant select on table public.mobile_release_policies
to anon, authenticated;

insert into public.mobile_release_policies (
  platform,
  latest_version,
  minimum_supported_version,
  store_url,
  update_message
)
values
  (
    'android',
    '1.0.0',
    '1.0.0',
    null,
    'A newer version of Masjid E Mamoor 2 is available.'
  ),
  (
    'ios',
    '1.0.0',
    '1.0.0',
    null,
    'A newer version of Masjid E Mamoor 2 is available.'
  );

create or replace function public.get_mobile_release_status(
  p_platform text,
  p_current_version text
)
returns table (
  platform text,
  current_version text,
  latest_version text,
  minimum_supported_version text,
  update_status text,
  store_url text,
  update_message text,
  policy_updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_platform text := lower(btrim(p_platform));
  v_current_version text := btrim(p_current_version);
  v_current_parts bigint[];
  v_latest_parts bigint[];
  v_minimum_parts bigint[];
  v_policy public.mobile_release_policies%rowtype;
begin
  if v_platform is null or v_platform not in ('android', 'ios') then
    raise exception 'invalid_platform' using errcode = '22023';
  end if;

  if v_current_version is null
     or v_current_version !~
       '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$' then
    raise exception 'invalid_current_version' using errcode = '22023';
  end if;

  select policy.*
  into v_policy
  from public.mobile_release_policies policy
  where policy.platform = v_platform;

  if not found then
    raise exception 'release_policy_not_found' using errcode = 'P0002';
  end if;

  v_current_parts := string_to_array(v_current_version, '.')::bigint[];
  v_latest_parts := string_to_array(v_policy.latest_version, '.')::bigint[];
  v_minimum_parts := string_to_array(
    v_policy.minimum_supported_version,
    '.'
  )::bigint[];

  return query
  select
    v_policy.platform,
    v_current_version,
    v_policy.latest_version,
    v_policy.minimum_supported_version,
    case
      when v_current_parts < v_minimum_parts then 'required'
      when v_current_parts < v_latest_parts then 'optional'
      else 'none'
    end,
    v_policy.store_url,
    v_policy.update_message,
    v_policy.updated_at;
end;
$$;

revoke execute on function public.get_mobile_release_status(text, text)
from public;

grant execute on function public.get_mobile_release_status(text, text)
to anon, authenticated;

commit;
