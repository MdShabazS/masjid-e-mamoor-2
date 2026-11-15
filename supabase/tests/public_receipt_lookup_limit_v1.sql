\set ON_ERROR_STOP on
begin;
do $$ begin
  if has_function_privilege('anon','public.consume_public_receipt_lookup(text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.consume_public_receipt_lookup(text,text)','EXECUTE') then
    raise exception 'FAIL: client can call receipt lookup limiter'; end if;
  if has_table_privilege('service_role','private.public_receipt_lookup_attempts','SELECT') then
    raise exception 'FAIL: service role can read private lookup audit'; end if;
end $$;
set local role service_role;
do $$ declare v_attempt record; v_index integer; begin
  for v_index in 1..6 loop
    select * into v_attempt from public.consume_public_receipt_lookup(
      repeat('a',64),repeat('b',64));
    if v_attempt.allowed is distinct from (v_index <= 5) then
      raise exception 'FAIL: public receipt lookup limit at attempt %: %',v_index,v_attempt; end if;
  end loop;
end $$;
reset role;
do $$ begin
  if (select count(*) from private.public_receipt_lookup_attempts
      where subject_hash=repeat('a',64) and receipt_hash=repeat('b',64))<>6 then
    raise exception 'FAIL: lookup access audit is incomplete'; end if;
end $$;
rollback;
