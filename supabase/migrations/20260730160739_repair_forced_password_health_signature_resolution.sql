create or replace function
  private.central_user_manager_forced_password_health_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with required_routines(
    procedure_identity,
    argument_names,
    expected_search_path,
    owner_name,
    runtime_execute
  ) as (
    values
      (
        'public.complete_forced_password_change_v2(uuid,integer,text,uuid,text,integer)'::text,
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_credential_version']::text[],
        'search_path=pg_catalog, public, private, extensions'::text,
        'postgres'::text,
        true
      ),
      (
        'private.complete_forced_password_change_v2_impl(uuid,integer,text,uuid,text,integer)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_credential_version']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', false
      ),
      (
        'public.release_forced_password_change_v2(uuid,integer,text,uuid,text,text)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_stage']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', true
      ),
      (
        'private.release_forced_password_change_v2_impl(uuid,integer,text,uuid,text,text)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_stage']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', false
      ),
      (
        'public.rollback_forced_password_change_v2(uuid,integer,text,uuid,text,integer,integer,text)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_expected_credential_version',
          'p_next_credential_version', 'p_stage']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', true
      ),
      (
        'private.rollback_forced_password_change_v2_impl(uuid,integer,text,uuid,text,integer,integer,text)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_expected_credential_version',
          'p_next_credential_version', 'p_stage']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', false
      ),
      (
        'public.advance_forced_password_profile_v2(uuid,integer,text,uuid,text,integer,integer,text,text)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_expected_credential_version',
          'p_next_credential_version', 'p_expected_stage', 'p_next_stage']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', true
      ),
      (
        'private.advance_forced_password_profile_v2_impl(uuid,integer,text,uuid,text,integer,integer,text,text)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_expected_credential_version',
          'p_next_credential_version', 'p_expected_stage', 'p_next_stage']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', false
      ),
      (
        'public.record_forced_password_late_fence_v2(uuid,integer,text,uuid,text,text,integer,integer)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_reason',
          'p_expected_credential_version', 'p_observed_credential_version']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', true
      ),
      (
        'private.record_forced_password_late_fence_v2_impl(uuid,integer,text,uuid,text,text,integer,integer)',
        array['p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_reason',
          'p_expected_credential_version', 'p_observed_credential_version']::text[],
        'search_path=pg_catalog, public, private, extensions', 'postgres', false
      )
  )
  select not exists (
    select 1
    from required_routines required
    where not exists (
      select 1
      from pg_catalog.pg_proc routine
      join pg_catalog.pg_namespace namespace
        on namespace.oid = routine.pronamespace
      where routine.oid =
          pg_catalog.to_regprocedure(required.procedure_identity)
        and routine.proargnames = required.argument_names
        and routine.prokind = 'f'
        and pg_catalog.format_type(routine.prorettype, null) = 'jsonb'
        and routine.prosecdef = true
        and routine.proconfig @> array[required.expected_search_path]
        and pg_catalog.pg_get_userbyid(routine.proowner) =
          required.owner_name
        and (
          (required.runtime_execute = false and namespace.nspname = 'private')
          or
          (required.runtime_execute = true and namespace.nspname = 'public')
        )
        and pg_catalog.has_function_privilege(
          'service_role', routine.oid, 'EXECUTE'
        ) = required.runtime_execute
        and not pg_catalog.has_function_privilege(
          'anon',
          routine.oid,
          'EXECUTE'
        )
        and not pg_catalog.has_function_privilege(
          'authenticated',
          routine.oid,
          'EXECUTE'
        )
    )
  );
$function$;

revoke all on function
  private.central_user_manager_forced_password_health_v1()
from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
