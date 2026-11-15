-- Apply fresh migrations first, then psql -v ON_ERROR_STOP=1 -f tests/phase8_tasks.sql
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated',
 'authenticated',email,'',now(),now(),now() from (values
 ('f1000000-0000-0000-0000-000000000001'::uuid,'phase8p@example.invalid'),
 ('f1000000-0000-0000-0000-000000000002'::uuid,'phase8a@example.invalid'),
 ('f1000000-0000-0000-0000-000000000003'::uuid,'phase8b@example.invalid'),
 ('f1000000-0000-0000-0000-000000000004'::uuid,'phase8c@example.invalid'),
 ('f1000000-0000-0000-0000-000000000005'::uuid,'phase8d@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('f1000000-0000-0000-0000-000000000001','president'),
 ('f1000000-0000-0000-0000-000000000002','member'),
 ('f1000000-0000-0000-0000-000000000003','member'),
 ('f1000000-0000-0000-0000-000000000004','member'),
 ('f1000000-0000-0000-0000-000000000005','member');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('f1000000-0000-0000-0000-000000000001','phase8president',false),
 ('f1000000-0000-0000-0000-000000000002','phase8membera',false),
 ('f1000000-0000-0000-0000-000000000003','phase8memberb',false),
 ('f1000000-0000-0000-0000-000000000004','phase8memberc',false),
 ('f1000000-0000-0000-0000-000000000005','phase8memberd',false);
do $$ begin
 if has_table_privilege('authenticated','public.work_task_participants','UPDATE')
 or has_table_privilege('authenticated','public.work_task_operations','SELECT')
 or has_function_privilege('anon','public.join_work_task(uuid,uuid)','EXECUTE') then
 raise exception 'task direct privilege leak'; end if;
end $$;

-- Synthetic JWTs use the actor UUID as their test session ID.
insert into auth.sessions(id,user_id)
select u.id,u.id from auth.users u join public.app_users a on a.id=u.id
on conflict do nothing;

select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000001","session_id":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.create_work_task('Courtyard','Clean the courtyard',null,null,'mixed',2,1,1,
 'f2000000-0000-0000-0000-000000000001') as task_id \gset
select set_config('phase8.task',:'task_id',true);
do $$ begin
 if (select is_creator from public.list_visible_work_tasks()
  where task_id=current_setting('phase8.task')::uuid) is not true then
  raise exception 'creator projection missing'; end if;
end $$;
select public.invite_work_task_member(current_setting('phase8.task')::uuid,
 'f1000000-0000-0000-0000-000000000002','f2000000-0000-0000-0000-000000000002');
select public.invite_work_task_member(current_setting('phase8.task')::uuid,
 'f1000000-0000-0000-0000-000000000003','f2000000-0000-0000-0000-000000000003');
do $$ begin
 begin
 perform public.join_work_task(current_setting('phase8.task')::uuid,
 'f2000000-0000-0000-0000-000000000004');
 raise exception 'creator joined own task';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000002","session_id":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select is_creator from public.list_visible_work_tasks()
  where task_id=current_setting('phase8.task')::uuid) is not false then
  raise exception 'member marked as creator'; end if;
end $$;
select public.join_work_task(current_setting('phase8.task')::uuid,
 'f2000000-0000-0000-0000-000000000005');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000003","session_id":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.join_work_task(current_setting('phase8.task')::uuid,
 'f2000000-0000-0000-0000-000000000006');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000004","session_id":"f1000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select public.join_work_task(current_setting('phase8.task')::uuid,
 'f2000000-0000-0000-0000-000000000007');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000005","session_id":"f1000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select public.join_work_task(current_setting('phase8.task')::uuid,
 'f2000000-0000-0000-0000-000000000008');
reset role;
do $$ begin
 if (select count(*) from public.work_task_participants where task_id=current_setting('phase8.task')::uuid
  and status='confirmed')<>2
 or (select count(*) from public.work_task_participants where task_id=current_setting('phase8.task')::uuid
  and status='waitlisted')<>2 then
 raise exception 'capacity did not hold'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000002","session_id":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.leave_work_task(current_setting('phase8.task')::uuid,
 'f2000000-0000-0000-0000-000000000009');
reset role;
do $$ begin
 if (select status from public.work_task_participants
  where task_id=current_setting('phase8.task')::uuid
  and member_id='f1000000-0000-0000-0000-000000000003')<>'confirmed'
 or (select status from public.work_task_participants
  where task_id=current_setting('phase8.task')::uuid
  and member_id='f1000000-0000-0000-0000-000000000005')<>'waitlisted' then
 raise exception 'FIFO source capacity promotion failed'; end if;
end $$;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000003","session_id":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.submit_work_task_completion(current_setting('phase8.task')::uuid,'finished',
 'f2000000-0000-0000-0000-000000000010');
do $$ begin
 if public.my_verified_task_count()<>0 then raise exception 'submission awarded point'; end if;
 begin
 perform public.review_work_task_completion(current_setting('phase8.task')::uuid,
 'f1000000-0000-0000-0000-000000000003','accept',null,
 'f2000000-0000-0000-0000-000000000011');
 raise exception 'member self reviewed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000001","session_id":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.review_work_task_completion(current_setting('phase8.task')::uuid,
 'f1000000-0000-0000-0000-000000000003','accept',null,
 'f2000000-0000-0000-0000-000000000012');
reset role;
select set_config('request.jwt.claims',
 '{"sub":"f1000000-0000-0000-0000-000000000003","session_id":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if public.my_verified_task_count()<>1 then raise exception 'creator review did not award point'; end if;
end $$;
rollback;
