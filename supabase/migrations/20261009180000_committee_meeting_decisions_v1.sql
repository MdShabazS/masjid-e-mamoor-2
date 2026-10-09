-- Masjid-e-Mamoor
-- Phase 11: append-only Committee Meeting decisions/outcomes.
--
-- V1 rules:
-- - President / Vice President / Secretary:
--     organization-wide authorized decision creation.
-- - Committee Member:
--     decision creation only for a meeting in which the current actor
--     is an existing participant.
-- - Auditor:
--     read-only.
-- - Finance / ordinary Member:
--     no decision-write authority.
-- - Decisions are append-only.
-- - Reads inherit the existing meeting read scope.
-- - Existing decisions survive meeting cancellation.
-- - No new decisions may be added to a cancelled meeting.
-- - Every create mutation is operation-idempotent and payload-bound.

begin;


-- ============================================================
-- 1. Decision record
-- ============================================================

create table public.committee_meeting_decisions (
  id uuid primary key
    default extensions.gen_random_uuid(),

  meeting_id uuid not null
    references public.committee_meetings(id)
    on delete restrict,

  decision_text text not null,

  created_by_application_user_id uuid not null
    references public.application_users(id)
    on delete restrict,

  operation_id text not null,
  request_fingerprint text not null,

  created_at timestamptz not null
    default now(),

  constraint committee_meeting_decisions_text_chk
    check (
      decision_text = btrim(decision_text)
      and length(decision_text) between 1 and 5000
    ),

  constraint committee_meeting_decisions_operation_chk
    check (
      operation_id = btrim(operation_id)
      and length(operation_id) between 1 and 200
    ),

  constraint committee_meeting_decisions_fingerprint_chk
    check (
      request_fingerprint ~ '^[0-9a-f]{64}$'
    )
);


create index committee_meeting_decisions_history_idx
  on public.committee_meeting_decisions(
    meeting_id,
    created_at,
    id
  );


create unique index
committee_meeting_decisions_actor_operation_uidx
  on public.committee_meeting_decisions(
    created_by_application_user_id,
    operation_id
  );


-- ============================================================
-- 2. RLS/read boundary
-- ============================================================

alter table public.committee_meeting_decisions
enable row level security;


create policy committee_meeting_decisions_authorized_read
on public.committee_meeting_decisions
for select
to authenticated
using (
  public.can_read_committee_meeting(meeting_id)
);


revoke all privileges
on table public.committee_meeting_decisions
from public, anon, authenticated;


grant select
on table public.committee_meeting_decisions
to authenticated;


grant all privileges
on table public.committee_meeting_decisions
to service_role;


-- ============================================================
-- 3. Decision write authorization
-- ============================================================

create or replace function
public.can_write_committee_meeting_decision(
  p_meeting_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, extensions
as $$
  select
    public.current_application_user_id() is not null

    and public.has_application_permission(
      'committee.meetings.manage'
    )

    and exists (
      select 1
      from public.application_users au
      join public.application_user_roles aur
        on aur.application_user_id = au.id
      join public.roles r
        on r.id = aur.role_id
      where au.id =
        public.current_application_user_id()

        and au.status = 'active'

        and (
          r.key in (
            'president',
            'vice_president',
            'secretary'
          )

          or (
            r.key = 'committee_member'
            and public.is_committee_meeting_participant(
              p_meeting_id
            )
          )
        )
    );
$$;


revoke execute
on function public.can_write_committee_meeting_decision(uuid)
from public, anon, authenticated, service_role;


-- ============================================================
-- 4. Trusted append command
-- ============================================================

create or replace function
public.create_committee_meeting_decision(
  p_meeting_id uuid,
  p_decision_text text,
  p_operation_id text
)
returns public.committee_meeting_decisions
language plpgsql
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_actor uuid :=
    public.current_application_user_id();

  v_text text :=
    nullif(btrim(p_decision_text), '');

  v_operation_id text :=
    nullif(btrim(p_operation_id), '');

  v_fingerprint text;

  v_existing
    public.committee_meeting_decisions;

  v_meeting
    public.committee_meetings;

  v_decision
    public.committee_meeting_decisions;
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

  if p_meeting_id is null then
    raise exception 'invalid_meeting_id'
      using errcode = '22023';
  end if;

  if v_text is null
     or length(v_text) > 5000 then
    raise exception 'invalid_decision_text'
      using errcode = '22023';
  end if;

  if v_operation_id is null
     or length(v_operation_id) > 200 then
    raise exception 'invalid_operation_id'
      using errcode = '22023';
  end if;

  v_fingerprint :=
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.jsonb_build_object(
          'operation',
            'meeting_decision_create',
          'meeting_id',
            p_meeting_id,
          'decision_text',
            v_text
        )::text,
        'sha256'
      ),
      'hex'
    );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text || ':' || v_operation_id,
      0
    )
  );

  select *
  into v_existing
  from public.committee_meeting_decisions d
  where d.created_by_application_user_id =
        v_actor
    and d.operation_id =
        v_operation_id;

  if found then
    if v_existing.meeting_id <>
         p_meeting_id

       or v_existing.decision_text <>
          v_text

       or v_existing.request_fingerprint <>
          v_fingerprint then

      raise exception 'operation_id_conflict'
        using errcode = '23505';
    end if;

    return v_existing;
  end if;

  select *
  into v_meeting
  from public.committee_meetings m
  where m.id = p_meeting_id
  for update;

  if not found then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if not public.can_write_committee_meeting_decision(
    p_meeting_id
  ) then
    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  if v_meeting.status = 'cancelled' then
    raise exception 'meeting_cancelled'
      using errcode = '22023';
  end if;

  insert into public.committee_meeting_decisions (
    meeting_id,
    decision_text,
    created_by_application_user_id,
    operation_id,
    request_fingerprint
  )
  values (
    p_meeting_id,
    v_text,
    v_actor,
    v_operation_id,
    v_fingerprint
  )
  returning *
  into v_decision;

  return v_decision;
end;
$$;


-- ============================================================
-- 5. Trusted decision-history query
-- ============================================================

create or replace function
public.list_committee_meeting_decisions(
  p_meeting_id uuid
)
returns setof public.committee_meeting_decisions
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

  if p_meeting_id is null
     or not public.can_read_committee_meeting(
       p_meeting_id
     ) then

    raise exception 'meeting_not_found'
      using errcode = 'P0002';
  end if;

  return query
  select d.*
  from public.committee_meeting_decisions d
  where d.meeting_id = p_meeting_id
  order by
    d.created_at,
    d.id;
end;
$$;


revoke execute
on function public.create_committee_meeting_decision(
  uuid,
  text,
  text
)
from public, anon, service_role;


revoke execute
on function public.list_committee_meeting_decisions(uuid)
from public, anon, service_role;


grant execute
on function public.create_committee_meeting_decision(
  uuid,
  text,
  text
)
to authenticated;


grant execute
on function public.list_committee_meeting_decisions(uuid)
to authenticated;


commit;
