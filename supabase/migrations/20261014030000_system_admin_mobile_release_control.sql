-- System Admin sets the direct APK update policy; every change is retained.
begin;

create table public.mobile_release_policy_audit (
  id uuid primary key default gen_random_uuid(),
  actor_application_user_id uuid not null references public.application_users(id),
  platform text not null check (platform = 'android'),
  previous_policy jsonb not null,
  next_policy jsonb not null,
  changed_at timestamptz not null default now()
);
alter table public.mobile_release_policy_audit enable row level security;
revoke all on public.mobile_release_policy_audit from public,anon,authenticated;
grant select on public.mobile_release_policy_audit to authenticated;
create policy mobile_release_policy_audit_admin_read
on public.mobile_release_policy_audit for select to authenticated
using (exists (
  select 1 from public.application_users au
  join public.application_user_roles aur on aur.application_user_id=au.id
  join public.roles r on r.id=aur.role_id
  where au.auth_user_id=auth.uid() and au.status='active' and r.key='system_admin'
));

create function public.reject_mobile_release_audit_change()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin raise exception 'release_audit_immutable' using errcode='55000'; end;
$$;
revoke all on function public.reject_mobile_release_audit_change()
  from public,anon,authenticated,service_role;
create trigger mobile_release_policy_audit_immutable
before update or delete on public.mobile_release_policy_audit
for each row execute function public.reject_mobile_release_audit_change();

create function public.set_android_release_policy(
  p_latest_version text,
  p_minimum_supported_version text,
  p_apk_url text,
  p_update_message text
) returns public.mobile_release_policies
language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid;
  v_previous public.mobile_release_policies;
  v_next public.mobile_release_policies;
  v_latest text := nullif(btrim(p_latest_version),'');
  v_minimum text := nullif(btrim(p_minimum_supported_version),'');
  v_url text := nullif(btrim(p_apk_url),'');
  v_message text := nullif(btrim(p_update_message),'');
begin
  select au.id into v_actor from public.application_users au
  join public.application_user_roles aur on aur.application_user_id=au.id
  join public.roles r on r.id=aur.role_id
  where au.auth_user_id=auth.uid() and au.status='active' and r.key='system_admin'
  for update of au,aur;
  if v_actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
  if v_latest is null or v_minimum is null
    or v_latest !~ '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$'
    or v_minimum !~ '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$'
    or v_url is null or length(v_url) > 500 or v_url !~* '^https://[^/@:?#]+/[^?[:space:]#]+\.apk(\?[^[:space:]#]*)?$'
    or v_message is null or length(v_message) > 500 then
    raise exception 'invalid_release_policy' using errcode='22023';
  end if;
  select * into v_previous from public.mobile_release_policies
  where platform='android' for update;
  if not found then raise exception 'release_policy_not_found' using errcode='P0002'; end if;
  if string_to_array(v_latest,'.')::bigint[] <
       string_to_array(v_previous.latest_version,'.')::bigint[]
    or string_to_array(v_minimum,'.')::bigint[] <
       string_to_array(v_previous.minimum_supported_version,'.')::bigint[]
    or string_to_array(v_minimum,'.')::bigint[] >
       string_to_array(v_latest,'.')::bigint[] then
    raise exception 'release_version_regression' using errcode='22023';
  end if;
  if v_latest = v_previous.latest_version
    and v_minimum = v_previous.minimum_supported_version
    and v_url = v_previous.store_url
    and v_message = v_previous.update_message then
    return v_previous;
  end if;
  update public.mobile_release_policies
  set latest_version=v_latest, minimum_supported_version=v_minimum,
      store_url=v_url, update_message=v_message
  where platform='android' returning * into v_next;
  insert into public.mobile_release_policy_audit
    (actor_application_user_id,platform,previous_policy,next_policy)
  values (v_actor,'android',to_jsonb(v_previous),to_jsonb(v_next));
  return v_next;
end;
$$;
revoke all on function public.set_android_release_policy(text,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.set_android_release_policy(text,text,text,text)
  to authenticated;

commit;
