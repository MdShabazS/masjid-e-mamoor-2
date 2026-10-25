-- Catalog regression for the fresh RPC trust boundary. Run after all migrations.
-- Text inspection is a guardrail, not a substitute for issued-session tests.
begin;
do $$
declare
  v_total integer;
  v_anon integer;
  v_auth integer;
  v_unpinned integer;
  v_unguarded text[];
  v_unsafe_private text[];
  v_dynamic_public text[];
  v_exposed_tables text[];
  v_private_bucket_count integer;
  v_storage_policy_count integer;
begin
  select count(*),
    count(*) filter (where has_function_privilege('anon',p.oid,'EXECUTE')),
    count(*) filter (where has_function_privilege('authenticated',p.oid,'EXECUTE')),
    count(*) filter (where p.proconfig is null or not 'search_path=pg_catalog'=any(p.proconfig))
  into v_total,v_anon,v_auth,v_unpinned
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef;

  if v_total<>103 or v_anon<>1 or v_auth<>76 or v_unpinned<>0 then
    raise exception 'public definer grant/search_path inventory drift: %, %, %, %',
      v_total,v_anon,v_auth,v_unpinned;
  end if;

  if not has_function_privilege('anon',
       'public.list_published_community_posts(integer)','EXECUTE')
     or has_function_privilege('anon',
       'public.list_monthly_donors()','EXECUTE')
     or has_function_privilege('anon',
       'public.lookup_active_receipt(text)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.lookup_active_receipt(text)','EXECUTE')
     or has_function_privilege('anon',
       'public.record_manual_receipt_handoff(uuid,text,text,text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.record_manual_receipt_handoff(uuid,text,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.lookup_active_receipt(text)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.claim_finance_report_artifact()','EXECUTE')
     or has_function_privilege('authenticated',
       'public.worker_finance_report_lines(uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.requeue_failed_finance_report_artifact(uuid,text,text,text,text)','EXECUTE')
     or has_function_privilege('anon',
       'public.post_direct_treasurer_cash(text,text,uuid,date,bigint,text,uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.post_direct_treasurer_cash(text,text,uuid,date,bigint,text,uuid,uuid)','EXECUTE')
     or has_function_privilege('anon',
       'public.submit_cash_task_count(uuid,date,bigint,text,uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.verify_cash_task_count(uuid,bigint,uuid,uuid)','EXECUTE')
     or has_function_privilege('anon',
       'public.list_cash_collection_workflow()','EXECUTE')
     or has_function_privilege('anon',
       'public.reject_cash_task_count(uuid,text,uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.reject_cash_task_count(uuid,text,uuid)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.requeue_failed_finance_report_artifact(uuid,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.claim_finance_report_artifact()','EXECUTE') then
    raise exception 'public RPC grant drift';
  end if;
  if has_function_privilege('anon','public.claim_stale_qr_object(text)','EXECUTE')
     or has_function_privilege('authenticated','public.claim_stale_qr_object(text)','EXECUTE')
     or not has_function_privilege('service_role','public.claim_stale_qr_object(text)','EXECUTE')
     or has_function_privilege('anon','public.finish_qr_object_cleanup(text)','EXECUTE')
     or has_function_privilege('authenticated','public.finish_qr_object_cleanup(text)','EXECUTE')
     or not has_function_privilege('service_role','public.finish_qr_object_cleanup(text)','EXECUTE')
     or not (select relrowsecurity from pg_class
       where oid='app_private.qr_cleanup_claims'::regclass) then
    raise exception 'QR cleanup service-only grant or private table RLS drift';
  end if;

  select array_agg(p.proname order by p.proname) into v_unguarded
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and position('app_private.require_actor' in lower(pg_get_functiondef(p.oid)))=0
    and p.proname not in
      ('current_app_role','current_identity_gate','list_published_community_posts');
  if v_unguarded is not null then
    raise exception 'authenticated definer lacks visible actor guard: %',v_unguarded;
  end if;

  select array_agg(p.proname order by p.proname) into v_unsafe_private
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.prosecdef
    and (has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
      or p.proconfig is null
      or not 'search_path=pg_catalog'=any(p.proconfig));
  if v_unsafe_private is not null then
    raise exception 'private definer exposure/search_path drift: %',v_unsafe_private;
  end if;

  select array_agg(p.proname order by p.proname) into v_dynamic_public
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and (pg_get_functiondef(p.oid) ~* 'execute[[:space:]]'
      or position('format(' in lower(pg_get_functiondef(p.oid)))>0
      or pg_get_functiondef(p.oid) ~* 'raw_user_meta_data|user_metadata');
  if v_dynamic_public is not null then
    raise exception 'public definer dynamic SQL or user metadata needs review: %',v_dynamic_public;
  end if;

  if position('app_private.active_auth_session' in
       lower(pg_get_functiondef('app_private.require_actor(text[])'::regprocedure)))=0
     or position('not i.must_change_password' in
       lower(pg_get_functiondef('app_private.require_actor(text[])'::regprocedure)))=0
     or position('u.role=any(p_roles)' in
       lower(pg_get_functiondef('app_private.require_actor(text[])'::regprocedure)))=0
     or position('auth.sessions' in
       lower(pg_get_functiondef('app_private.active_auth_session()'::regprocedure)))=0
     or position('s.user_id = auth.uid()' in
       lower(pg_get_functiondef('app_private.active_auth_session()'::regprocedure)))=0 then
    raise exception 'actor/session gate body drift';
  end if;

  if position('app_private.active_auth_session' in
       lower(pg_get_functiondef('public.current_app_role()'::regprocedure)))=0
     or position('not i.must_change_password' in
       lower(pg_get_functiondef('public.current_app_role()'::regprocedure)))=0
     or position('app_private.active_auth_session' in
       lower(pg_get_functiondef('public.current_identity_gate()'::regprocedure)))=0
     or position('p.audience=''public''' in
       lower(pg_get_functiondef('public.list_published_community_posts(integer)'::regprocedure)))=0
     or position('p.status=''published''' in
       lower(pg_get_functiondef('public.list_published_community_posts(integer)'::regprocedure)))=0
     or position('p.publish_at<=now()' in
       lower(pg_get_functiondef('public.list_published_community_posts(integer)'::regprocedure)))=0
     or position('p.expire_at>now()' in
       lower(pg_get_functiondef('public.list_published_community_posts(integer)'::regprocedure)))=0 then
    raise exception 'allowed definer exception body drift';
  end if;

  if has_table_privilege('anon','public.app_users','SELECT')
     or has_table_privilege('authenticated','public.finance_effects','SELECT')
     or has_table_privilege('authenticated','public.direct_cash_posts','SELECT')
     or has_table_privilege('authenticated','public.cash_task_counts','SELECT')
     or has_table_privilege('authenticated','public.cash_task_verification_links','SELECT')
     or has_table_privilege('authenticated','public.cash_slip_claims','SELECT')
     or has_table_privilege('anon','public.monthly_donors','SELECT') then
    raise exception 'private table became directly readable';
  end if;

  select array_agg(c.relname order by c.relname) into v_exposed_tables
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
    and (not c.relrowsecurity
      or has_table_privilege('anon',c.oid,'SELECT')
      or has_table_privilege('anon',c.oid,'INSERT')
      or has_table_privilege('anon',c.oid,'UPDATE')
      or has_table_privilege('anon',c.oid,'DELETE')
      or has_table_privilege('authenticated',c.oid,'SELECT')
      or has_table_privilege('authenticated',c.oid,'INSERT')
      or has_table_privilege('authenticated',c.oid,'UPDATE')
      or has_table_privilege('authenticated',c.oid,'DELETE'));
  if v_exposed_tables is not null then
    raise exception 'public table exposed outside guarded RPCs: %',v_exposed_tables;
  end if;

  select count(*) into v_private_bucket_count
  from storage.buckets b
  where b.id='qr-private' and not b.public
    and b.file_size_limit=5242880
    and b.allowed_mime_types @> array['image/png','image/jpeg']::text[]
    and cardinality(b.allowed_mime_types)=2;
  select count(*) into v_storage_policy_count
  from pg_policies p
  where p.schemaname='storage' and p.tablename='objects';
  if v_private_bucket_count<>1 or not exists(
       select 1 from storage.buckets b where b.id='finance-reports-private'
        and not b.public and b.file_size_limit=15000000
        and b.allowed_mime_types @> array['application/pdf','text/csv']::text[]
        and cardinality(b.allowed_mime_types)=2)
     or v_storage_policy_count<>0 then
    raise exception 'private QR bucket or object policy drift: %, %',
      v_private_bucket_count,v_storage_policy_count;
  end if;
end $$;
rollback;
