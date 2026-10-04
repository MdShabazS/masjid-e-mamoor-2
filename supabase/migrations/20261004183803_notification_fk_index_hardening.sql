begin;

create index notifications_actor_application_user_id_idx
  on public.notifications(actor_application_user_id);

create index notifications_source_activity_id_idx
  on public.notifications(source_activity_id);

commit;
