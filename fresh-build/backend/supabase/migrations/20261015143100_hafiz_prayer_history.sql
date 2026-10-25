-- One Hafiz prayer register. An authorized human attests completion of prayer;
-- no timetable is inferred from the clock or from member Jummah attendance.
begin;
create table public.hafiz_prayer_marks (
 prayer_date date not null,
 prayer_slot text not null check(prayer_slot in ('fajr','dhuhr','asr','maghrib','isha')),
 mark text not null check(mark in ('present','absent')),
 revision integer not null default 1 check(revision>0),
 marked_by uuid not null references public.app_users(id) on delete restrict,
 marked_at timestamptz not null default now(),
 primary key(prayer_date,prayer_slot)
);
create table public.hafiz_prayer_history (
 operation_id uuid primary key,
 prayer_date date not null,
 prayer_slot text not null check(prayer_slot in ('fajr','dhuhr','asr','maghrib','isha')),
 old_mark text check(old_mark in ('present','absent')),
 new_mark text not null check(new_mark in ('present','absent')),
 revision integer not null check(revision>0),
 actor_id uuid not null references public.app_users(id) on delete restrict,
 attested_after_prayer boolean not null check(attested_after_prayer),
 recorded_at timestamptz not null default now(),
 unique(prayer_date,prayer_slot,revision)
);
create trigger hafiz_prayer_history_immutable before update or delete on public.hafiz_prayer_history
 for each row execute function app_private.reject_immutable_finance_change();
alter table public.hafiz_prayer_marks enable row level security;
alter table public.hafiz_prayer_history enable row level security;
revoke all on public.hafiz_prayer_marks from public,anon,authenticated;
revoke all on public.hafiz_prayer_history from public,anon,authenticated;

create function public.record_hafiz_prayer(p_date date,p_slot text,p_mark text,
 p_attested_after_prayer boolean,p_operation_id uuid)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=app_private.require_actor(array['president','vice_president','secretary','treasurer']);
 v_old public.hafiz_prayer_marks; v_history public.hafiz_prayer_history;
 v_revision integer;
begin
 if p_operation_id is null or p_date is null
  or p_date>(now() at time zone 'Asia/Kolkata')::date
  or p_slot not in ('fajr','dhuhr','asr','maghrib','isha')
  or p_mark not in ('present','absent') or p_attested_after_prayer is distinct from true then
  raise exception 'invalid_prayer_attestation' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,92));
 select * into v_history from public.hafiz_prayer_history where operation_id=p_operation_id;
 if found then
  if v_history.actor_id<>v_actor or v_history.prayer_date<>p_date
   or v_history.prayer_slot<>p_slot or v_history.new_mark<>p_mark then
   raise exception 'operation_id_conflict' using errcode='23505'; end if;
  return v_history.revision;
 end if;
 -- Serialize by day and slot even when the current row does not yet exist.
 perform pg_advisory_xact_lock(hashtextextended(p_date::text||':'||p_slot,93));
 select * into v_old from public.hafiz_prayer_marks
  where prayer_date=p_date and prayer_slot=p_slot for update;
 if found and v_old.mark=p_mark then
  raise exception 'unchanged_prayer_mark' using errcode='22023'; end if;
 v_revision:=case when found then v_old.revision+1 else 1 end;
 if v_revision=1 then
  insert into public.hafiz_prayer_marks(prayer_date,prayer_slot,mark,marked_by)
   values(p_date,p_slot,p_mark,v_actor);
 else
  update public.hafiz_prayer_marks set mark=p_mark,revision=v_revision,marked_by=v_actor,
   marked_at=now() where prayer_date=p_date and prayer_slot=p_slot;
 end if;
 insert into public.hafiz_prayer_history(operation_id,prayer_date,prayer_slot,old_mark,
  new_mark,revision,actor_id,attested_after_prayer)
 values(p_operation_id,p_date,p_slot,v_old.mark,p_mark,v_revision,v_actor,true);
 return v_revision;
end $$;

create function public.list_hafiz_prayer_marks(p_start date,p_end_exclusive date)
returns table(prayer_date date,prayer_slot text,mark text,revision integer,
 marked_by uuid,marked_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 perform app_private.require_actor(array['president','vice_president','secretary','treasurer']);
 if p_start is null or p_end_exclusive is null or p_end_exclusive<=p_start
  or p_end_exclusive>p_start+366 then
  raise exception 'invalid_prayer_range' using errcode='22023'; end if;
 return query select m.prayer_date,m.prayer_slot,m.mark,m.revision,m.marked_by,m.marked_at
  from public.hafiz_prayer_marks m
  where m.prayer_date>=p_start and m.prayer_date<p_end_exclusive
  order by m.prayer_date,m.prayer_slot;
end $$;

revoke all on function public.record_hafiz_prayer(date,text,text,boolean,uuid)
 from public,anon,authenticated;
revoke all on function public.list_hafiz_prayer_marks(date,date)
 from public,anon,authenticated;
grant execute on function public.record_hafiz_prayer(date,text,text,boolean,uuid) to authenticated;
grant execute on function public.list_hafiz_prayer_marks(date,date) to authenticated;
commit;
