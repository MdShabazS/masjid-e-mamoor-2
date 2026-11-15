-- Expose only the approval switch to the two staff roles requested for manual
-- receipt handoff. The switch remains off until the Board's recorded approval.
begin;

create function public.manual_receipt_handoff_enabled()
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform app_private.require_actor(array['treasurer','committee_member']);
  return exists(select 1 from app_private.receipt_handoff_policy
    where id and enabled and decision_reference is not null);
end $$;
revoke all on function public.manual_receipt_handoff_enabled()
  from public,anon,authenticated;
grant execute on function public.manual_receipt_handoff_enabled() to authenticated;

-- The earlier audit RPC allowed other leaders while the policy was off. Keep
-- the database write boundary aligned with the owner's two sender roles.
create function app_private.require_manual_receipt_sender()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if not exists(select 1 from public.app_users
    where id=new.actor_id and role in ('treasurer','committee_member')) then
    raise exception 'receipt_handoff_sender_not_authorized' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function app_private.require_manual_receipt_sender()
  from public,anon,authenticated;
create trigger receipt_handoff_sender_guard before insert
  on public.receipt_handoff_events for each row
  execute function app_private.require_manual_receipt_sender();

commit;
