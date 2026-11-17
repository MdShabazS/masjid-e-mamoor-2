-- Rollback-only proof of who may get a donor's WhatsApp number (owner decision 17 Nov 2026).
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000'::uuid,'authenticated','authenticated',email,'',now(),now(),now()
from (values
 ('d9000000-0000-0000-0000-000000000001'::uuid,'wapres@example.invalid'),
 ('d9000000-0000-0000-0000-000000000002'::uuid,'watreas@example.invalid'),
 ('d9000000-0000-0000-0000-000000000003'::uuid,'wareferrer@example.invalid'),
 ('d9000000-0000-0000-0000-000000000004'::uuid,'waother@example.invalid'),
 ('d9000000-0000-0000-0000-000000000005'::uuid,'waadmin@example.invalid')) f(id,email);
insert into public.app_users(id,role) values
 ('d9000000-0000-0000-0000-000000000001','president'),
 ('d9000000-0000-0000-0000-000000000002','treasurer'),
 ('d9000000-0000-0000-0000-000000000003','member'),
 ('d9000000-0000-0000-0000-000000000004','committee_member'),
 ('d9000000-0000-0000-0000-000000000005','system_admin');
insert into app_private.username_aliases(user_id,username,must_change_password) values
 ('d9000000-0000-0000-0000-000000000001','wapres',false),
 ('d9000000-0000-0000-0000-000000000002','watreas',false),
 ('d9000000-0000-0000-0000-000000000003','wareferrer',false),
 ('d9000000-0000-0000-0000-000000000004','waother',false),
 ('d9000000-0000-0000-0000-000000000005','waadmin',false);
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,now(),now() from auth.users where email like 'wa%@example.invalid';
insert into public.monthly_donors(id,name,whatsapp,suggested_amount_paise,referrer_id,entered_by,
  consent_method,consent_recorded_at,active,opted_out_at) values
 ('d9100000-0000-0000-0000-000000000001','Referred donor','+919000000101',30000,
  'd9000000-0000-0000-0000-000000000003','d9000000-0000-0000-0000-000000000003','in-person',now(),true,null),
 ('d9100000-0000-0000-0000-000000000002','Opted-out donor','+919000000102',30000,
  'd9000000-0000-0000-0000-000000000003','d9000000-0000-0000-0000-000000000003','in-person',now(),false,now());

-- Referrer: own donor only, both kinds, recorded.
select set_config('request.jwt.claims','{"sub":"d9000000-0000-0000-0000-000000000003","session_id":"d9000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if (select whatsapp from public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','monthly_request','2026-11-01')) <> '+919000000101' then
    raise exception 'referrer did not get the number'; end if;
  perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','reminder','2026-11-01');
  if (select count(*) from public.list_messageable_donors('2026-11-01')) <> 1 then
    raise exception 'referrer should see exactly one messageable donor'; end if;
  begin
    perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000002','reminder','2026-11-01');
    raise exception 'opted-out donor was handed out';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','receipt','2026-11-01');
    raise exception 'receipt kind accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','reminder','2026-11-15');
    raise exception 'mid-month period accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- Another committee member: no numbers, empty list.
select set_config('request.jwt.claims','{"sub":"d9000000-0000-0000-0000-000000000004","session_id":"d9000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','reminder','2026-11-01');
    raise exception 'non-referrer got the number';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.list_messageable_donors('2026-11-01')) then
    raise exception 'non-referrer sees donors to message'; end if;
end $$;
reset role;

-- System Admin: not a donor messenger.
select set_config('request.jwt.claims','{"sub":"d9000000-0000-0000-0000-000000000005","session_id":"d9000000-0000-0000-0000-000000000005","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','reminder','2026-11-01');
    raise exception 'System Admin got the number';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Treasurer: any active donor.
select set_config('request.jwt.claims','{"sub":"d9000000-0000-0000-0000-000000000002","session_id":"d9000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  perform public.prepare_donor_whatsapp('d9100000-0000-0000-0000-000000000001','reminder','2026-11-01');
  if (select count(*) from public.list_messageable_donors('2026-11-01')) <> 1 then
    raise exception 'Treasurer should see the one active donor'; end if;
end $$;
reset role;

-- The record is complete and cannot be edited.
do $$ begin
  if (select count(*) from app_private.donor_whatsapp_sends) <> 3 then
    raise exception 'expected 3 recorded hand-outs, got %', (select count(*) from app_private.donor_whatsapp_sends); end if;
  begin
    delete from app_private.donor_whatsapp_sends;
    raise exception 'send record was deletable';
  exception when others then
    if sqlerrm = 'send record was deletable' then raise; end if;
  end;
end $$;
rollback;
