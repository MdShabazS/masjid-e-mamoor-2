-- Apply fresh migrations first; psql -v ON_ERROR_STOP=1 -f tests/phase10_content.sql
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('b1000000-0000-0000-0000-000000000001'::uuid,'phase10p@example.invalid'),
 ('b1000000-0000-0000-0000-000000000002'::uuid,'phase10m@example.invalid'),
 ('b1000000-0000-0000-0000-000000000003'::uuid,'phase10n@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('b1000000-0000-0000-0000-000000000001','president'),
 ('b1000000-0000-0000-0000-000000000002','member'),
 ('b1000000-0000-0000-0000-000000000003','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('b1000000-0000-0000-0000-000000000001','phase10president',false),
 ('b1000000-0000-0000-0000-000000000002','phase10member',false),
 ('b1000000-0000-0000-0000-000000000003','phase10other',false);
do $$ begin
 if has_table_privilege('anon','public.community_posts','SELECT')
  or has_table_privilege('authenticated','public.member_inbox','SELECT')
  or has_function_privilege('anon','public.list_member_community_posts(integer)','EXECUTE')
  or has_function_privilege('anon','public.list_managed_community_posts(integer)','EXECUTE')
  or has_function_privilege('authenticated','public.queue_due_member_post_notifications()','EXECUTE') then
  raise exception 'content direct privilege leak'; end if;
end $$;
-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"b1000000-0000-0000-0000-000000000001","session_id":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_community_post('Published notice','Welcome to the masjid','public',
 'b2000000-0000-0000-0000-000000000001') as public_id \gset
select public.create_community_post('Members only','Private meeting information','members',
 'b2000000-0000-0000-0000-000000000002') as members_id \gset
select public.create_community_post('Draft notice','Not approved','public',
 'b2000000-0000-0000-0000-000000000003') as draft_id \gset
select set_config('phase10.public',:'public_id',true),
 set_config('phase10.members',:'members_id',true),set_config('phase10.draft',:'draft_id',true);
select public.publish_community_post(current_setting('phase10.public')::uuid,now()-interval '1 minute',
 now()+interval '1 hour',1,'b2000000-0000-0000-0000-000000000004');
select public.publish_community_post(current_setting('phase10.members')::uuid,now()-interval '1 minute',
 null,1,'b2000000-0000-0000-0000-000000000005');
do $$ begin
 if (select count(*) from public.list_managed_community_posts(50))<>3 then
  raise exception 'editor cannot review drafts'; end if;
end $$;
select public.revise_community_post(current_setting('phase10.public')::uuid,
 'Published notice','Updated welcome to the masjid','public',2,
 'b2000000-0000-0000-0000-000000000007');
reset role;
set local role anon;
do $$ begin
 if (select count(*) from public.list_published_community_posts(20))<>1
  or (select body from public.list_published_community_posts(20))<>'Updated welcome to the masjid' then
  raise exception 'anonymous public projection leaked content'; end if;
 begin
  perform public.list_member_community_posts(20);
  raise exception 'anonymous member feed allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
 if public.queue_due_member_post_notifications()<3 then
  raise exception 'member notice not queued for active users'; end if;
 if public.queue_due_member_post_notifications()<>0 then
  raise exception 'duplicate member notices queued'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"b1000000-0000-0000-0000-000000000002","session_id":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.list_member_community_posts(20))<>2
  or (select count(*) from public.list_my_member_inbox(25))<>1 then
  raise exception 'member projection incorrect'; end if;
 begin
  perform public.create_community_post('Bad','Unauthorised','public',
   'b2000000-0000-0000-0000-000000000006');
  raise exception 'member published content';
 exception when insufficient_privilege then null; end;
 begin
  perform public.list_managed_community_posts(50);
  raise exception 'member saw editorial drafts';
 exception when insufficient_privilege then null; end;
end $$;
select public.mark_my_member_notification_read(i.notification_id)
 from public.list_my_member_inbox(25) i;
do $$ begin
 if (select count(*) from public.list_my_member_inbox(25) where read_at is not null)<>1 then
  raise exception 'read state not persisted'; end if;
end $$;
reset role;
rollback;
