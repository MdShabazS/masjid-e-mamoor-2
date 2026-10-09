-- Masjid-e-Mamoor
-- Committee Meetings V1: durable notification integration.
--
-- Extends the existing notifications domain rather than creating
-- a second notification store.

begin;


-- ------------------------------------------------------------
-- Extend durable notification source support to meetings
-- ------------------------------------------------------------

alter table public.notifications
  add column source_meeting_activity_id uuid
    references public.committee_meeting_activity(id)
    on delete restrict;


-- Preserve all existing task kinds and add the approved
-- Meeting V1 lifecycle events.
alter table public.notifications
  drop constraint notifications_kind_chk;

alter table public.notifications
  add constraint notifications_kind_chk
  check (
    kind in (
      'task_assigned',
      'task_unassigned',
      'task_updated',
      'task_progress',
      'task_started',
      'task_completed',
      'meeting_created',
      'meeting_updated',
      'meeting_cancelled'
    )
  );


-- A notification may originate from the task activity domain
-- or the meeting activity domain, but never both simultaneously.
alter table public.notifications
  add constraint notifications_activity_source_exclusive_chk
  check (
    num_nonnulls(
      source_activity_id,
      source_meeting_activity_id
    ) <= 1
  );


create unique index
  notifications_meeting_activity_kind_recipient_uidx
on public.notifications (
  recipient_application_user_id,
  source_meeting_activity_id,
  kind
)
where source_meeting_activity_id is not null;


create index notifications_meeting_source_idx
on public.notifications (
  source_entity_id,
  created_at desc
)
where source_type = 'committee_meeting';


-- ------------------------------------------------------------
-- Meeting notification recipients
--
-- Meeting lifecycle notifications go to current active
-- participants in the meeting's assigned scope.
-- The actor is excluded by the creator function.
-- ------------------------------------------------------------

create or replace function
public.committee_meeting_event_recipient_ids(
  p_meeting_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select coalesce(
    array_agg(
      distinct au.id
      order by au.id
    ),
    '{}'::uuid[]
  )
  from public.committee_meeting_participants cmp
  join public.application_users au
    on au.id = cmp.application_user_id
  where cmp.meeting_id = p_meeting_id
    and au.status = 'active';
$$;

revoke execute
on function public.committee_meeting_event_recipient_ids(uuid)
from public, anon, authenticated, service_role;


-- ------------------------------------------------------------
-- Durable meeting notification producer
-- ------------------------------------------------------------

create or replace function
public.create_committee_meeting_notifications(
  p_meeting_id uuid,
  p_activity_id uuid,
  p_kind text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid;
  v_title text;
  v_notification_title text;
  v_inserted integer;
  v_recipient_ids uuid[];
begin
  select
    activity.actor_application_user_id,
    meeting.title
  into
    v_actor,
    v_title
  from public.committee_meeting_activity activity
  join public.committee_meetings meeting
    on meeting.id = activity.meeting_id
  where activity.id = p_activity_id
    and activity.meeting_id = p_meeting_id;

  if v_actor is null then
    raise exception 'invalid_notification_source'
      using errcode = '22023';
  end if;

  if p_kind not in (
    'meeting_created',
    'meeting_updated',
    'meeting_cancelled'
  ) then
    raise exception 'invalid_notification_kind'
      using errcode = '22023';
  end if;

  v_notification_title :=
    case p_kind
      when 'meeting_created'
        then 'Meeting scheduled'
      when 'meeting_updated'
        then 'Meeting updated'
      when 'meeting_cancelled'
        then 'Meeting cancelled'
    end;

  v_recipient_ids :=
    public.committee_meeting_event_recipient_ids(
      p_meeting_id
    );

  insert into public.notifications (
    recipient_application_user_id,
    actor_application_user_id,
    kind,
    title,
    body,
    target_path,
    source_type,
    source_entity_id,
    source_meeting_activity_id,
    metadata
  )
  select distinct
    recipient.id,
    v_actor,
    p_kind,
    v_notification_title,
    v_title,
    '/work/meetings/' || p_meeting_id::text,
    'committee_meeting',
    p_meeting_id,
    p_activity_id,
    jsonb_build_object(
      'meeting_id',
      p_meeting_id,
      'activity_id',
      p_activity_id
    )
  from unnest(v_recipient_ids) recipient(id)
  join public.application_users au
    on au.id = recipient.id
  where recipient.id <> v_actor
    and au.status = 'active'
  on conflict (
    recipient_application_user_id,
    source_meeting_activity_id,
    kind
  )
  where source_meeting_activity_id is not null
  do nothing;

  get diagnostics v_inserted = row_count;

  return v_inserted;
end;
$$;

revoke execute
on function public.create_committee_meeting_notifications(
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


-- ------------------------------------------------------------
-- Activity → notification bridge
--
-- Domain mutation writes its authoritative meeting activity first.
-- This trigger creates the corresponding durable in-app
-- notification rows from that committed business event.
-- ------------------------------------------------------------

create or replace function
public.handle_committee_meeting_activity_notifications()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
begin
  perform public.create_committee_meeting_notifications(
    new.meeting_id,
    new.id,
    new.activity_type
  );

  return new;
end;
$$;

revoke execute
on function public.handle_committee_meeting_activity_notifications()
from public, anon, authenticated, service_role;


create trigger committee_meeting_activity_notifications_trg
after insert
on public.committee_meeting_activity
for each row
execute function
  public.handle_committee_meeting_activity_notifications();


commit;
