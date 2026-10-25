-- Phase 11: provider-neutral delivery state. There is NO sender or live template configured.
begin;
create table app_private.whatsapp_activation (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 phone_number_id text,
 sender_e164 text,
 request_template text,
 reminder_template text,
 language_code text,
 reviewed_at timestamptz,
 check(not enabled or (phone_number_id ~ '^[0-9]{5,30}$'
  and sender_e164 ~ '^\+[1-9][0-9]{7,14}$'
  and request_template ~ '^[a-z][a-z0-9_]{1,127}$'
  and reminder_template ~ '^[a-z][a-z0-9_]{1,127}$'
  and language_code ~ '^[a-z]{2}(_[A-Z]{2})?$' and reviewed_at is not null))
);
insert into app_private.whatsapp_activation(singleton,enabled) values(true,false);
alter table app_private.whatsapp_activation enable row level security;
revoke all on app_private.whatsapp_activation from public,anon,authenticated;

alter table public.monthly_message_outbox
 drop constraint monthly_message_outbox_state_check;
alter table public.monthly_message_outbox add constraint monthly_message_state_check
 check(state in ('queued','sending','sent','cancelled','failed'));
alter table public.monthly_message_outbox add column attempt_count integer not null default 0
 check(attempt_count between 0 and 5);
alter table public.monthly_message_outbox add column next_attempt_at timestamptz not null default now();
alter table public.monthly_message_outbox add column lease_token uuid unique;
alter table public.monthly_message_outbox add column lease_until timestamptz;
alter table public.monthly_message_outbox add column last_error_code text;
alter table public.monthly_message_outbox add constraint monthly_message_lease_check
 check((state='sending' and lease_token is not null and lease_until is not null)
  or (state<>'sending' and lease_token is null and lease_until is null));
create index monthly_outbox_claim_due on public.monthly_message_outbox(next_attempt_at,id)
 where state='queued';

create table public.whatsapp_inbound_events (
 provider_message_id text primary key check(length(provider_message_id) between 3 and 240),
 from_e164 text not null check(from_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 kind text not null check(kind in ('stop','other')),
 received_at timestamptz not null default now()
);
create table public.whatsapp_delivery_events (
 provider_message_id text not null,
 event_state text not null check(event_state in ('sent','delivered','read','failed')),
 provider_timestamp text,
 received_at timestamptz not null default now(),
 primary key(provider_message_id,event_state,provider_timestamp)
);
create trigger whatsapp_inbound_immutable before update or delete on public.whatsapp_inbound_events
 for each row execute function app_private.reject_immutable_finance_change();
create trigger whatsapp_delivery_immutable before update or delete on public.whatsapp_delivery_events
 for each row execute function app_private.reject_immutable_finance_change();
alter table public.whatsapp_inbound_events enable row level security;
alter table public.whatsapp_delivery_events enable row level security;
revoke all on public.whatsapp_inbound_events from public,anon,authenticated;
revoke all on public.whatsapp_delivery_events from public,anon,authenticated;

create function app_private.monthly_message_eligible(p_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.monthly_message_outbox o
  join public.monthly_donors d on d.id=o.donor_id
  join public.monthly_requests r on r.id=o.request_id
  join public.masjid_accounts a on a.id=o.account_id
  join app_private.approved_consent_versions cv on cv.version=d.consent_version
  where o.id=p_id and d.active and d.opted_out_at is null and a.active
   and o.consent_version=d.consent_version and r.donor_id=o.donor_id
   and r.period_date=o.period_date and r.qr_sha256=o.qr_sha256
   and r.account_id=o.account_id
   and not exists(select 1 from public.ledger_entries le
    join public.payment_claims c on c.id=le.source_id
    where c.donor_id=o.donor_id and c.period_date=o.period_date)
   and (o.purpose<>'reminder' or exists(select 1 from public.monthly_message_outbox initial
    where initial.donor_id=o.donor_id and initial.period_date=o.period_date
     and initial.purpose='request' and initial.state='sent'
     and initial.sent_at<=now()-interval '5 days')));
$$;
revoke all on function app_private.monthly_message_eligible(uuid) from public,anon,authenticated;

create function public.claim_next_monthly_whatsapp(p_now timestamptz)
returns table(outbox_id uuid,lease_id uuid,to_e164 text,phone_number_id text,
 template_name text,language_code text,amount_paise text,qr_digest text,account_id uuid)
language plpgsql security definer set search_path=pg_catalog as $$
declare v_config app_private.whatsapp_activation; v_outbox public.monthly_message_outbox;
 v_donor public.monthly_donors; v_template text; v_lease uuid;
begin
 if p_now is null or abs(extract(epoch from(p_now-now())))>120 then
  raise exception 'invalid_claim_time' using errcode='22023'; end if;
 select * into v_config from app_private.whatsapp_activation where singleton and enabled;
 if not found then return; end if;
 select * into v_outbox from public.monthly_message_outbox o
  where o.state='queued' and o.next_attempt_at<=p_now
  order by o.next_attempt_at,o.id for update skip locked limit 1;
 if not found then return; end if;
 select * into v_donor from public.monthly_donors where id=v_outbox.donor_id for update;
 if not app_private.monthly_message_eligible(v_outbox.id) then
  update public.monthly_message_outbox set state='cancelled',last_error_code='ineligible'
   where id=v_outbox.id;
  return;
 end if;
 v_template:=case when v_outbox.purpose='request'
  then v_config.request_template else v_config.reminder_template end;
 v_lease:=gen_random_uuid();
 update public.monthly_message_outbox set state='sending',attempt_count=attempt_count+1,
  lease_token=v_lease,lease_until=p_now+interval '90 seconds' where id=v_outbox.id;
 return query select v_outbox.id,v_lease,v_donor.whatsapp,v_config.phone_number_id,
  v_template,v_config.language_code,r.suggested_amount_paise::text,
  v_outbox.qr_sha256,v_outbox.account_id
  from public.monthly_requests r where r.id=v_outbox.request_id;
end $$;

create function public.preflight_monthly_whatsapp(p_outbox_id uuid,p_lease_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_o public.monthly_message_outbox;
begin
 select * into v_o from public.monthly_message_outbox where id=p_outbox_id for update;
 if not found or v_o.state<>'sending' or v_o.lease_token is distinct from p_lease_id
  or v_o.lease_until<=now() then return false; end if;
 perform 1 from public.monthly_donors where id=v_o.donor_id for update;
 if not exists(select 1 from app_private.whatsapp_activation where singleton and enabled)
  or not app_private.monthly_message_eligible(p_outbox_id) then
  update public.monthly_message_outbox set state='cancelled',lease_token=null,
   lease_until=null,last_error_code='ineligible' where id=p_outbox_id;
  return false;
 end if;
 return true;
end $$;

create function public.finish_monthly_whatsapp(p_outbox_id uuid,p_lease_id uuid,
 p_provider_message_id text,p_error_code text,p_retryable boolean)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare v_o public.monthly_message_outbox; v_next text;
begin
 select * into v_o from public.monthly_message_outbox where id=p_outbox_id for update;
 if not found or v_o.state<>'sending' or v_o.lease_token is distinct from p_lease_id then
  raise exception 'invalid_delivery_lease' using errcode='42501'; end if;
 if p_provider_message_id is not null and length(p_provider_message_id) between 3 and 240
  and p_error_code is null then
  update public.monthly_message_outbox set state='sent',sent_at=now(),
   provider_message_id=p_provider_message_id,lease_token=null,lease_until=null,
   last_error_code=null where id=p_outbox_id;
  return 'sent';
 end if;
 if p_provider_message_id is not null or p_error_code is null or p_error_code not in
  ('rate_limited','provider_rejected','provider_unavailable','transport_unknown') then
  raise exception 'invalid_delivery_result' using errcode='22023'; end if;
 v_next:=case when p_retryable and p_error_code='rate_limited'
  and v_o.attempt_count<5 then 'queued' else 'failed' end;
 update public.monthly_message_outbox set state=v_next,lease_token=null,lease_until=null,
  last_error_code=p_error_code,
  next_attempt_at=now()+make_interval(secs=>least(60*power(2,v_o.attempt_count-1)::integer,3600))
 where id=p_outbox_id;
 return v_next;
end $$;

create function public.record_signed_whatsapp_inbound(p_message_id text,p_from_e164 text,
 p_text text)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_kind text; v_count integer:=0; v_donor record;
begin
 if p_message_id is null or length(p_message_id) not between 3 and 240
  or p_from_e164 !~ '^\+[1-9][0-9]{7,14}$' then
  raise exception 'invalid_inbound' using errcode='22023'; end if;
 v_kind:=case when upper(btrim(p_text)) in ('STOP','UNSUBSCRIBE','CANCEL') then 'stop' else 'other' end;
 insert into public.whatsapp_inbound_events(provider_message_id,from_e164,kind)
 values(p_message_id,p_from_e164,v_kind) on conflict do nothing;
 if not found or v_kind<>'stop' then return 0; end if;
 for v_donor in select id from public.monthly_donors
  where whatsapp=p_from_e164 and active order by id for update loop
  perform public.record_monthly_donor_opt_out(v_donor.id,p_message_id);
  update public.monthly_message_outbox set state='cancelled',last_error_code='opted_out'
   where donor_id=v_donor.id and state='queued';
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

create function public.record_signed_whatsapp_status(p_provider_message_id text,
 p_state text,p_provider_timestamp text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_provider_message_id is null or length(p_provider_message_id) not between 3 and 240
  or p_state not in ('sent','delivered','read','failed')
  or p_provider_timestamp is null or length(p_provider_timestamp) not between 1 and 30 then
  raise exception 'invalid_status' using errcode='22023'; end if;
 insert into public.whatsapp_delivery_events(provider_message_id,event_state,provider_timestamp)
 values(p_provider_message_id,p_state,p_provider_timestamp) on conflict do nothing;
 return found;
end $$;

-- Aggregate operational view; never return donor names or phone numbers.
create function public.monthly_whatsapp_delivery_health()
returns table(message_state text,reason text,total bigint,oldest_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $$
 select o.state,o.last_error_code,count(*),min(o.queued_at)
 from public.monthly_message_outbox o
 group by o.state,o.last_error_code;
$$;

revoke all on function public.claim_next_monthly_whatsapp(timestamptz) from public,anon,authenticated;
revoke all on function public.preflight_monthly_whatsapp(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_monthly_whatsapp(uuid,uuid,text,text,boolean)
 from public,anon,authenticated;
revoke all on function public.record_signed_whatsapp_inbound(text,text,text)
 from public,anon,authenticated;
revoke all on function public.record_signed_whatsapp_status(text,text,text)
 from public,anon,authenticated;
revoke all on function public.monthly_whatsapp_delivery_health()
 from public,anon,authenticated;
grant execute on function public.claim_next_monthly_whatsapp(timestamptz) to service_role;
grant execute on function public.preflight_monthly_whatsapp(uuid,uuid) to service_role;
grant execute on function public.finish_monthly_whatsapp(uuid,uuid,text,text,boolean) to service_role;
grant execute on function public.record_signed_whatsapp_inbound(text,text,text) to service_role;
grant execute on function public.record_signed_whatsapp_status(text,text,text) to service_role;
grant execute on function public.monthly_whatsapp_delivery_health() to service_role;
commit;
