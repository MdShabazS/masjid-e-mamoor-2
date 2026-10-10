-- Regression coverage for trigger-function least privilege.
--
-- Trigger-only functions must not be directly executable by Supabase client
-- roles. Intentionally public release/referral RPCs must remain available.

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.protect_finance_reconciliation_history()',
    'public.protect_finance_reconciliation_item_history()',
    'public.set_updated_at()'
  ]
  loop
    if has_function_privilege(
      'anon',
      v_signature,
      'EXECUTE'
    ) then
      raise exception
        'FAIL: anon retains EXECUTE on %',
        v_signature;
    end if;

    if has_function_privilege(
      'authenticated',
      v_signature,
      'EXECUTE'
    ) then
      raise exception
        'FAIL: authenticated retains EXECUTE on %',
        v_signature;
    end if;
  end loop;

  if not has_function_privilege(
    'anon',
    'public.get_mobile_release_status(text,text)',
    'EXECUTE'
  ) then
    raise exception
      'FAIL: anonymous mobile release status access was removed';
  end if;

  if not has_function_privilege(
    'anon',
    'public.submit_referral_onboarding(text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'FAIL: anonymous referral submission access was removed';
  end if;

  if not has_function_privilege(
    'anon',
    'public.validate_referral_code(text)',
    'EXECUTE'
  ) then
    raise exception
      'FAIL: anonymous referral validation access was removed';
  end if;

  raise notice
    'PASS: trigger-only functions are not client executable';

  raise notice
    'PASS: intentional anonymous application RPCs remain available';
end
$$;
