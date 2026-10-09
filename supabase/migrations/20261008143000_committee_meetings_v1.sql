-- Masjid-e-Mamoor
-- Committee Meetings V1
--
-- Authoritative meeting + participant + meeting-attendance workflow.
-- Broader offline/GPS attendance remains outside this migration.

begin;

create table public.committee_meetings (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  meeting_type text not null default 'general',
  details text,
  location text,

  scheduled_start timestamptz not null,
  scheduled_end timestamptz,

  status text not null default 'scheduled',

  created_by_application_user_id uuid not null
    references public.application_users(id),

  cancelled_by_application_user_id uuid
    references public.application_users(id),

  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint committee_meetings_title_chk
    check (length(btrim(title)) between 1 and 200),

  constraint committee_meetings_type_chk
    check (length(btrim(meeting_type)) between 1 and 100),

  constraint committee_meetings_details_chk
    check (details is null or length(details) <= 5000),

  constraint committee_meetings_location_chk
    check (location is null or length(location) <= 500),

  constraint committee_meetings_time_chk
    check (
      scheduled_end is null
      or scheduled_end > scheduled_start
    ),

  constraint committee_meetings_status_chk
    check (status in ('scheduled', 'cancelled')),

  constraint committee_meetings_cancel_state_chk
    check (
      (
        status = 'scheduled'
        and cancelled_by_application_user_id is null
        and cancelled_at is null
        and cancellation_reason is null
      )
      or
      (
        status = 'cancelled'
        and cancelled_by_application_user_id is not null
        and cancelled_at is not null
        and cancellation_reason is not null
        and length(btrim(cancellation_reason)) between 1 and 2000
      )
    )
);

create index committee_meetings_start_idx
  on public.committee_meetings(scheduled_start, id);

create table public.committee_meeting_participants (
  id uuid primary key default gen_random_uuid(),

  meeting_id uuid not null
    references public.committee_meetings(id),

  application_user_id uuid not null
    references public.application_users(id),

  assigned_by_application_user_id uuid not null
    references public.application_users(id),

  assigned_at timestamptz not null default now(),

  unique (meeting_id, application_user_id)
);

create index committee_meeting_participants_user_idx
  on public.committee_meeting_participants(
    application_user_id,
    meeting_id
  );

create table public.committee_meeting_attendance (
  id uuid primary key default gen_random_uuid(),

  meeting_id uuid not null
    references public.committee_meetings(id),

  application_user_id uuid not null
    references public.application_users(id),

  attendance_status text not null,

  recorded_by_application_user_id uuid not null
    references public.application_users(id),

  recorded_at timestamptz not null default now(),

  operation_id text not null,
  request_fingerprint text not null,

  constraint committee_meeting_attendance_status_chk
    check (attendance_status in ('present', 'absent')),

  constraint committee_meeting_attendance_operation_chk
    check (length(btrim(operation_id)) between 1 and 200),

  unique (meeting_id, application_user_id),

  unique (
    recorded_by_application_user_id,
    operation_id
  )
);

create table public.committee_meeting_activity (
  id uuid primary key default gen_random_uuid(),

  meeting_id uuid not null
    references public.committee_meetings(id),

  actor_application_user_id uuid not null
    references public.application_users(id),

  activity_type text not null,
  details jsonb not null default '{}'::jsonb,

  operation_id text not null,
  request_fingerprint text not null,

  created_at timestamptz not null default now(),

  constraint committee_meeting_activity_type_chk
    check (
      activity_type in (
        'meeting_created',
        'meeting_updated',
        'meeting_cancelled'
      )
    ),

  constraint committee_meeting_activity_operation_chk
    check (length(btrim(operation_id)) between 1 and 200),

  unique (
    actor_application_user_id,
    operation_id
  )
);

create index committee_meeting_activity_meeting_idx
  on public.committee_meeting_activity(
    meeting_id,
    created_at,
    id
  );

alter table public.committee_meetings
  enable row level security;

alter table public.committee_meeting_participants
  enable row level security;

alter table public.committee_meeting_attendance
  enable row level security;

alter table public.committee_meeting_activity
  enable row level security;


-- ------------------------------------------------------------
-- Read-scope helpers
-- ------------------------------------------------------------

create or replace function public.is_committee_meeting_participant(
  p_meeting_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select exists (
    select 1
    from public.committee_meeting_participants cmp
    where cmp.meeting_id = p_meeting_id
      and cmp.application_user_id =
        public.current_application_user_id()
  );
$$;

create or replace function public.can_read_committee_meeting(
  p_meeting_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;
begin
  if v_actor is null then
    return false;
  end if;

  if not public.has_application_permission(
    'committee.meetings.read'
  ) then
    return false;
  end if;

  select r.key
  into v_role
  from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id
  where aur.application_user_id = v_actor
  limit 1;

  if v_role in (
    'president',
    'vice_president',
    'secretary',
    'auditor'
  ) then
    return true;
  end if;

  if v_role = 'committee_member' then
    return public.is_committee_meeting_participant(
      p_meeting_id
    );
  end if;

  return false;
end;
$$;


-- ------------------------------------------------------------
-- Table privilege boundary
-- ------------------------------------------------------------

revoke all privileges
on table public.committee_meetings
from public, anon, authenticated;

revoke all privileges
on table public.committee_meeting_participants
from public, anon, authenticated;

revoke all privileges
on table public.committee_meeting_attendance
from public, anon, authenticated;

revoke all privileges
on table public.committee_meeting_activity
from public, anon, authenticated;

grant select
on table public.committee_meetings
to authenticated;

grant select
on table public.committee_meeting_participants
to authenticated;

grant select
on table public.committee_meeting_attendance
to authenticated;

grant select
on table public.committee_meeting_activity
to authenticated;

grant all privileges
on table public.committee_meetings,
         public.committee_meeting_participants,
         public.committee_meeting_attendance,
         public.committee_meeting_activity
to service_role;


-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

create policy committee_meetings_authorized_read
on public.committee_meetings
for select
to authenticated
using (
  public.can_read_committee_meeting(id)
);

create policy committee_meeting_participants_authorized_read
on public.committee_meeting_participants
for select
to authenticated
using (
  public.can_read_committee_meeting(meeting_id)
);

create policy committee_meeting_attendance_authorized_read
on public.committee_meeting_attendance
for select
to authenticated
using (
  public.can_read_committee_meeting(meeting_id)
);

create policy committee_meeting_activity_authorized_read
on public.committee_meeting_activity
for select
to authenticated
using (
  public.can_read_committee_meeting(meeting_id)
);


-- ------------------------------------------------------------
-- Participant option discovery
-- Only organization-wide meeting managers may choose participants.
-- ------------------------------------------------------------

create or replace function public.list_committee_meeting_participant_options()
returns table (
  application_user_id uuid,
  display_name text,
  role_label text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.meetings.manage'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select r.key
  into v_role
  from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id
  where aur.application_user_id = v_actor
  limit 1;

  if v_role not in (
    'president',
    'vice_president',
    'secretary'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  return query
  select
    au.id,
    coalesce(
      nullif(btrim(mp.display_name), ''),
      r.name || ' · ' || left(au.id::text, 8)
    ),
    r.name
  from public.application_users au
  join public.application_user_roles aur
    on aur.application_user_id = au.id
  join public.roles r
    on r.id = aur.role_id
  left join public.member_profiles mp
    on mp.application_user_id = au.id
  where au.status = 'active'
    and r.key in (
      'president',
      'vice_president',
      'secretary',
      'auditor',
      'committee_member'
    )
  order by 2, au.id;
end;
$$;


-- ------------------------------------------------------------
-- Create meeting
-- ------------------------------------------------------------

create or replace function public.create_committee_meeting(
  p_title text,
  p_meeting_type text,
  p_details text,
  p_location text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_participant_ids uuid[],
  p_operation_id text
)
returns public.committee_meetings
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;

  v_title text := btrim(p_title);
  v_type text := lower(btrim(p_meeting_type));
  v_details text := nullif(btrim(p_details), '');
  v_location text := nullif(btrim(p_location), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');

  v_participant_ids uuid[];
  v_fingerprint text;

  v_existing public.committee_meeting_activity;
  v_meeting public.committee_meetings;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.meetings.manage'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select r.key
  into v_role
  from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id
  where aur.application_user_id = v_actor
  limit 1;

  if v_role not in (
    'president',
    'vice_president',
    'secretary'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  if v_title is null
     or length(v_title) not between 1 and 200 then
    raise exception 'invalid_title'
      using errcode = '22023';
  end if;

  if v_type is null
     or length(v_type) not between 1 and 100 then
    raise exception 'invalid_meeting_type'
      using errcode = '22023';
  end if;

  if v_details is not null
     and length(v_details) > 5000 then
    raise exception 'invalid_details'
      using errcode = '22023';
  end if;

  if v_location is not null
     and length(v_location) > 500 then
    raise exception 'invalid_location'
      using errcode = '22023';
  end if;

  if p_scheduled_start is null then
    raise exception 'invalid_scheduled_start'
      using errcode = '22023';
  end if;

  if p_scheduled_end is not null
     and p_scheduled_end <= p_scheduled_start then
    raise exception 'invalid_scheduled_end'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(distinct id order by id),
    '{}'::uuid[]
  )
  into v_participant_ids
  from unnest(
    coalesce(p_participant_ids, '{}'::uuid[])
  ) as requested(id);

  if cardinality(v_participant_ids) = 0 then
    raise exception 'participants_required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_participant_ids) requested(id)
    where not exists (
      select 1
      from public.application_users au
      join public.application_user_roles aur
        on aur.application_user_id = au.id
      join public.roles r
        on r.id = aur.role_id
      where au.id = requested.id
        and au.status = 'active'
        and r.key in (
          'president',
          'vice_president',
          'secretary',
          'auditor',
          'committee_member'
        )
    )
  ) then
    raise exception 'invalid_participant'
      using errcode = '22023';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        v_title,
        v_type,
        coalesce(v_details, ''),
        coalesce(v_location, ''),
        p_scheduled_start::text,
        coalesce(p_scheduled_end::text, ''),
        v_participant_ids::text
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_meeting_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_meeting
    from public.committee_meetings
    where id = v_existing.meeting_id;

    return v_meeting;
  end if;

  insert into public.committee_meetings (
    title,
    meeting_type,
    details,
    location,
    scheduled_start,
    scheduled_end,
    created_by_application_user_id
  )
  values (
    v_title,
    v_type,
    v_details,
    v_location,
    p_scheduled_start,
    p_scheduled_end,
    v_actor
  )
  returning * into v_meeting;

  insert into public.committee_meeting_participants (
    meeting_id,
    application_user_id,
    assigned_by_application_user_id
  )
  select
    v_meeting.id,
    id,
    v_actor
  from unnest(v_participant_ids) id;

  insert into public.committee_meeting_activity (
    meeting_id,
    actor_application_user_id,
    activity_type,
    details,
    operation_id,
    request_fingerprint
  )
  values (
    v_meeting.id,
    v_actor,
    'meeting_created',
    jsonb_build_object(
      'participant_ids',
      to_jsonb(v_participant_ids),
      'notification_event',
      'meeting_created'
    ),
    v_operation_id,
    v_fingerprint
  );

  return v_meeting;
end;
$$;


-- ------------------------------------------------------------
-- List meetings
-- ------------------------------------------------------------

create or replace function public.list_committee_meetings(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  meeting_type text,
  details text,
  location text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status text,
  created_by_application_user_id uuid,
  cancelled_by_application_user_id uuid,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  participant_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.meetings.read'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  if p_limit is null
     or p_limit < 1
     or p_limit > 200
     or p_offset is null
     or p_offset < 0 then
    raise exception 'invalid_pagination'
      using errcode = '22023';
  end if;

  return query
  select
    cm.id,
    cm.title,
    cm.meeting_type,
    cm.details,
    cm.location,
    cm.scheduled_start,
    cm.scheduled_end,
    cm.status,
    cm.created_by_application_user_id,
    cm.cancelled_by_application_user_id,
    cm.cancelled_at,
    cm.cancellation_reason,
    cm.created_at,
    cm.updated_at,
    coalesce(
      array_agg(
        cmp.application_user_id
        order by cmp.application_user_id
      ) filter (
        where cmp.application_user_id is not null
      ),
      '{}'::uuid[]
    )
  from public.committee_meetings cm
  left join public.committee_meeting_participants cmp
    on cmp.meeting_id = cm.id
  where public.can_read_committee_meeting(cm.id)
  group by cm.id
  order by cm.scheduled_start desc, cm.id
  limit p_limit
  offset p_offset;
end;
$$;


-- ------------------------------------------------------------
-- Meeting detail
-- ------------------------------------------------------------

create or replace function public.get_committee_meeting(
  p_meeting_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_result jsonb;
begin
  if public.current_application_user_id() is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.can_read_committee_meeting(
    p_meeting_id
  ) then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'meeting',
    to_jsonb(cm),

    'participants',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'application_user_id',
            cmp.application_user_id,
            'display_name',
            coalesce(
              nullif(btrim(mp.display_name), ''),
              r.name || ' · ' ||
              left(au.id::text, 8)
            ),
            'role_label',
            r.name,
            'assigned_at',
            cmp.assigned_at
          )
          order by
            coalesce(
              nullif(btrim(mp.display_name), ''),
              r.name
            ),
            au.id
        )
        from public.committee_meeting_participants cmp
        join public.application_users au
          on au.id = cmp.application_user_id
        join public.application_user_roles aur
          on aur.application_user_id = au.id
        join public.roles r
          on r.id = aur.role_id
        left join public.member_profiles mp
          on mp.application_user_id = au.id
        where cmp.meeting_id = cm.id
      ),
      '[]'::jsonb
    ),

    'attendance',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(cma)
          order by cma.recorded_at, cma.id
        )
        from public.committee_meeting_attendance cma
        where cma.meeting_id = cm.id
      ),
      '[]'::jsonb
    ),

    'activity',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(a)
          order by a.created_at, a.id
        )
        from public.committee_meeting_activity a
        where a.meeting_id = cm.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.committee_meetings cm
  where cm.id = p_meeting_id;

  if v_result is null then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;


-- ------------------------------------------------------------
-- Update meeting
-- ------------------------------------------------------------

create or replace function public.update_committee_meeting(
  p_meeting_id uuid,
  p_title text,
  p_meeting_type text,
  p_details text,
  p_location text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_participant_ids uuid[],
  p_operation_id text
)
returns public.committee_meetings
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;
  v_meeting public.committee_meetings;

  v_title text := btrim(p_title);
  v_type text := lower(btrim(p_meeting_type));
  v_details text := nullif(btrim(p_details), '');
  v_location text := nullif(btrim(p_location), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');

  v_participant_ids uuid[];
  v_fingerprint text;
  v_existing public.committee_meeting_activity;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.meetings.manage'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select r.key
  into v_role
  from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id
  where aur.application_user_id = v_actor
  limit 1;

  if v_role not in (
    'president',
    'vice_president',
    'secretary'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select *
  into v_meeting
  from public.committee_meetings
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if v_meeting.status = 'cancelled' then
    raise exception 'meeting_cancelled'
      using errcode = '55000';
  end if;

  if v_title is null
     or length(v_title) not between 1 and 200 then
    raise exception 'invalid_title'
      using errcode = '22023';
  end if;

  if v_type is null
     or length(v_type) not between 1 and 100 then
    raise exception 'invalid_meeting_type'
      using errcode = '22023';
  end if;

  if v_details is not null
     and length(v_details) > 5000 then
    raise exception 'invalid_details'
      using errcode = '22023';
  end if;

  if v_location is not null
     and length(v_location) > 500 then
    raise exception 'invalid_location'
      using errcode = '22023';
  end if;

  if p_scheduled_start is null then
    raise exception 'invalid_scheduled_start'
      using errcode = '22023';
  end if;

  if p_scheduled_end is not null
     and p_scheduled_end <= p_scheduled_start then
    raise exception 'invalid_scheduled_end'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(distinct id order by id),
    '{}'::uuid[]
  )
  into v_participant_ids
  from unnest(
    coalesce(p_participant_ids, '{}'::uuid[])
  ) requested(id);

  if cardinality(v_participant_ids) = 0 then
    raise exception 'participants_required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_participant_ids) requested(id)
    where not exists (
      select 1
      from public.application_users au
      join public.application_user_roles aur
        on aur.application_user_id = au.id
      join public.roles r
        on r.id = aur.role_id
      where au.id = requested.id
        and au.status = 'active'
        and r.key in (
          'president',
          'vice_president',
          'secretary',
          'auditor',
          'committee_member'
        )
    )
  ) then
    raise exception 'invalid_participant'
      using errcode = '22023';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_meeting_id::text,
        v_title,
        v_type,
        coalesce(v_details, ''),
        coalesce(v_location, ''),
        p_scheduled_start::text,
        coalesce(p_scheduled_end::text, ''),
        v_participant_ids::text
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_meeting_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint
       or v_existing.meeting_id <> p_meeting_id then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_meeting
    from public.committee_meetings
    where id = p_meeting_id;

    return v_meeting;
  end if;

  update public.committee_meetings
  set
    title = v_title,
    meeting_type = v_type,
    details = v_details,
    location = v_location,
    scheduled_start = p_scheduled_start,
    scheduled_end = p_scheduled_end,
    updated_at = now()
  where id = p_meeting_id
  returning * into v_meeting;

  delete from public.committee_meeting_participants
  where meeting_id = p_meeting_id
    and application_user_id <> all(v_participant_ids);

  insert into public.committee_meeting_participants (
    meeting_id,
    application_user_id,
    assigned_by_application_user_id
  )
  select
    p_meeting_id,
    id,
    v_actor
  from unnest(v_participant_ids) id
  on conflict (
    meeting_id,
    application_user_id
  ) do nothing;

  -- Attendance belonging to removed participants must not
  -- silently disappear. Removing an already-recorded participant
  -- is therefore rejected.
  if exists (
    select 1
    from public.committee_meeting_attendance cma
    where cma.meeting_id = p_meeting_id
      and not (
        cma.application_user_id =
        any(v_participant_ids)
      )
  ) then
    raise exception 'participant_has_attendance'
      using errcode = '55000';
  end if;

  insert into public.committee_meeting_activity (
    meeting_id,
    actor_application_user_id,
    activity_type,
    details,
    operation_id,
    request_fingerprint
  )
  values (
    p_meeting_id,
    v_actor,
    'meeting_updated',
    jsonb_build_object(
      'participant_ids',
      to_jsonb(v_participant_ids),
      'notification_event',
      'meeting_updated'
    ),
    v_operation_id,
    v_fingerprint
  );

  return v_meeting;
end;
$$;


-- ------------------------------------------------------------
-- Cancel meeting
-- ------------------------------------------------------------

create or replace function public.cancel_committee_meeting(
  p_meeting_id uuid,
  p_reason text,
  p_operation_id text
)
returns public.committee_meetings
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;
  v_reason text := nullif(btrim(p_reason), '');
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;

  v_existing public.committee_meeting_activity;
  v_meeting public.committee_meetings;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.meetings.manage'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select r.key
  into v_role
  from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id
  where aur.application_user_id = v_actor
  limit 1;

  if v_role not in (
    'president',
    'vice_president',
    'secretary'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  if v_reason is null
     or length(v_reason) > 2000 then
    raise exception 'invalid_reason'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_meeting_id::text,
        v_reason
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_meeting_activity
  where actor_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint
       or v_existing.meeting_id <> p_meeting_id then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    select *
    into v_meeting
    from public.committee_meetings
    where id = p_meeting_id;

    return v_meeting;
  end if;

  select *
  into v_meeting
  from public.committee_meetings
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if v_meeting.status = 'cancelled' then
    raise exception 'meeting_cancelled'
      using errcode = '55000';
  end if;

  update public.committee_meetings
  set
    status = 'cancelled',
    cancelled_by_application_user_id = v_actor,
    cancelled_at = now(),
    cancellation_reason = v_reason,
    updated_at = now()
  where id = p_meeting_id
  returning * into v_meeting;

  insert into public.committee_meeting_activity (
    meeting_id,
    actor_application_user_id,
    activity_type,
    details,
    operation_id,
    request_fingerprint
  )
  values (
    p_meeting_id,
    v_actor,
    'meeting_cancelled',
    jsonb_build_object(
      'reason',
      v_reason,
      'notification_event',
      'meeting_cancelled'
    ),
    v_operation_id,
    v_fingerprint
  );

  return v_meeting;
end;
$$;


-- ------------------------------------------------------------
-- Record meeting attendance
-- ------------------------------------------------------------

create or replace function public.record_committee_meeting_attendance(
  p_meeting_id uuid,
  p_application_user_id uuid,
  p_attendance_status text,
  p_operation_id text
)
returns public.committee_meeting_attendance
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid := public.current_application_user_id();
  v_role text;
  v_status text := lower(btrim(p_attendance_status));
  v_operation_id text := nullif(btrim(p_operation_id), '');
  v_fingerprint text;

  v_existing public.committee_meeting_attendance;
  v_meeting public.committee_meetings;
  v_attendance public.committee_meeting_attendance;
begin
  if v_actor is null then
    raise exception 'not_authenticated'
      using errcode = '42501';
  end if;

  if not public.has_application_permission(
    'committee.attendance.record'
  ) then
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select r.key
  into v_role
  from public.application_user_roles aur
  join public.roles r on r.id = aur.role_id
  where aur.application_user_id = v_actor
  limit 1;

  if v_role in (
    'president',
    'vice_president',
    'secretary'
  ) then
    null;
  elsif v_role = 'committee_member' then
    -- Assigned Committee Members can record attendance only
    -- for meetings in their own assigned scope.
    if not public.is_committee_meeting_participant(
      p_meeting_id
    ) then
      raise exception 'missing_permission'
        using errcode = '42501';
    end if;
  else
    raise exception 'missing_permission'
      using errcode = '42501';
  end if;

  select *
  into v_meeting
  from public.committee_meetings
  where id = p_meeting_id
  for update;

  if not found then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if v_meeting.status = 'cancelled' then
    raise exception 'meeting_cancelled'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.committee_meeting_participants cmp
    where cmp.meeting_id = p_meeting_id
      and cmp.application_user_id =
        p_application_user_id
  ) then
    raise exception 'not_meeting_participant'
      using errcode = '22023';
  end if;

  if v_status not in ('present', 'absent') then
    raise exception 'invalid_attendance_status'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        p_meeting_id::text,
        p_application_user_id::text,
        v_status
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_meeting_attendance
  where recorded_by_application_user_id = v_actor
    and operation_id = v_operation_id;

  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    return v_existing;
  end if;

  if exists (
    select 1
    from public.committee_meeting_attendance cma
    where cma.meeting_id = p_meeting_id
      and cma.application_user_id =
        p_application_user_id
  ) then
    raise exception 'attendance_already_recorded'
      using errcode = '23505';
  end if;

  insert into public.committee_meeting_attendance (
    meeting_id,
    application_user_id,
    attendance_status,
    recorded_by_application_user_id,
    operation_id,
    request_fingerprint
  )
  values (
    p_meeting_id,
    p_application_user_id,
    v_status,
    v_actor,
    v_operation_id,
    v_fingerprint
  )
  returning * into v_attendance;

  return v_attendance;
end;
$$;


-- ------------------------------------------------------------
-- Function privilege boundaries
-- ------------------------------------------------------------

revoke all
on function public.is_committee_meeting_participant(uuid)
from public, anon, authenticated, service_role;

revoke all
on function public.can_read_committee_meeting(uuid)
from public, anon, authenticated, service_role;

revoke all
on function public.list_committee_meeting_participant_options()
from public, anon, authenticated, service_role;

revoke all
on function public.create_committee_meeting(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  uuid[],
  text
)
from public, anon, authenticated, service_role;

revoke all
on function public.list_committee_meetings(integer, integer)
from public, anon, authenticated, service_role;

revoke all
on function public.get_committee_meeting(uuid)
from public, anon, authenticated, service_role;

revoke all
on function public.update_committee_meeting(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  uuid[],
  text
)
from public, anon, authenticated, service_role;

revoke all
on function public.cancel_committee_meeting(uuid, text, text)
from public, anon, authenticated, service_role;

revoke all
on function public.record_committee_meeting_attendance(
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function public.is_committee_meeting_participant(uuid)
to authenticated;

grant execute
on function public.can_read_committee_meeting(uuid)
to authenticated;

grant execute
on function public.list_committee_meeting_participant_options()
to authenticated;

grant execute
on function public.create_committee_meeting(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  uuid[],
  text
)
to authenticated;

grant execute
on function public.list_committee_meetings(integer, integer)
to authenticated;

grant execute
on function public.get_committee_meeting(uuid)
to authenticated;

grant execute
on function public.update_committee_meeting(
  uuid,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  uuid[],
  text
)
to authenticated;

grant execute
on function public.cancel_committee_meeting(
  uuid,
  text,
  text
)
to authenticated;

grant execute
on function public.record_committee_meeting_attendance(
  uuid,
  uuid,
  text,
  text
)
to authenticated;

commit;
