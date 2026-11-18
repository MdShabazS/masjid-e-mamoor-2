-- Found in the 17 November phone test: members-only announcements reached members only after the
-- scheduled queue job ran, and nothing runs it yet; members also saw only the title.
-- Opening Notifications now adds the due member announcements for that person, then lists them
-- with their text. The queue job stays valid and harmless (same unique key, conflicts ignored).

drop function public.list_my_member_inbox(integer);

create function public.list_my_member_inbox(p_limit integer default 25)
returns table(notification_id uuid, title text, body text, created_at timestamptz, read_at timestamptz)
language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare v_actor uuid := app_private.require_actor(array['system_admin','president','vice_president',
  'secretary','treasurer','committee_member','member','data_entry']);
begin
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  insert into public.member_inbox(member_id, post_id, post_revision)
  select v_actor, p.id, p.revision from public.community_posts p
  where p.status = 'published' and p.audience = 'members'
    and p.publish_at <= now() and (p.expire_at is null or p.expire_at > now())
  on conflict (member_id, post_id, post_revision) do nothing;
  return query select i.id, p.title, p.body, i.created_at, i.read_at
  from public.member_inbox i
  join public.community_posts p on p.id = i.post_id
  where i.member_id = v_actor and p.status = 'published' and p.publish_at <= now()
    and (p.expire_at is null or p.expire_at > now())
  order by i.created_at desc, i.id desc limit p_limit;
end;
$$;

revoke all on function public.list_my_member_inbox(integer) from public, anon, authenticated;
grant execute on function public.list_my_member_inbox(integer) to authenticated;
