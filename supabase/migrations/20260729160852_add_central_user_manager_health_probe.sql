create function private.central_user_manager_health_probe_v1_impl()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with required_admin_columns(column_name) as (
    values
      ('user_id'::text),
      ('email'::text),
      ('is_active'::text),
      ('must_change_password'::text),
      ('credential_version'::text)
  ),
  required_operation_columns(table_name, column_name) as (
    values
      ('admin_user_operations'::text, 'operation_id'::text),
      ('admin_user_operations'::text, 'request_hash'::text),
      ('admin_user_operations'::text, 'fence_version'::text),
      ('admin_user_mutation_locks'::text, 'operation_id'::text),
      ('admin_user_mutation_locks'::text, 'fence_version'::text),
      ('admin_user_provider_events'::text, 'operation_id'::text)
  ),
  required_runtime_functions(function_name) as (
    values
      ('public.resume_admin_user_operation_v2'::text),
      ('public.renew_admin_user_operation_lease'::text),
      ('public.commit_admin_user_provider_intent_v2'::text),
      ('public.commit_admin_user_provider_outcome_v2'::text),
      ('public.complete_admin_user_operation_v2'::text),
      ('public.quarantine_admin_user_operation'::text),
      ('public.mark_admin_user_operation_needs_review'::text),
      ('public.record_admin_user_late_fence_v2'::text),
      ('public.create_admin_user_profile_for_operation_v2'::text),
      ('public.prepare_admin_user_create_compensation_v2'::text),
      ('public.advance_admin_user_profile_for_operation_v2'::text),
      ('public.activate_admin_user_profile_for_operation_v2'::text),
      ('public.list_reconciled_admin_users_v1'::text)
  ),
  checks as (
    select
      true as database_ok,
      pg_catalog.to_regclass('public.admin_users') is not null
        and not exists (
          select 1
          from required_admin_columns required
          where not exists (
            select 1
            from pg_catalog.pg_attribute attribute
            where attribute.attrelid =
              pg_catalog.to_regclass('public.admin_users')
              and attribute.attname = required.column_name
              and attribute.attnum > 0
              and not attribute.attisdropped
          )
        ) as admin_users_ok,
      pg_catalog.to_regclass('public.admin_user_operations') is not null
        and pg_catalog.to_regclass('public.admin_user_mutation_locks') is not null
        and pg_catalog.to_regclass('public.admin_user_provider_events') is not null
        and not exists (
          select 1
          from required_operation_columns required
          where not exists (
            select 1
            from pg_catalog.pg_attribute attribute
            where attribute.attrelid = pg_catalog.to_regclass(
              'public.' || required.table_name
            )
              and attribute.attname = required.column_name
              and attribute.attnum > 0
              and not attribute.attisdropped
          )
        )
        and not exists (
          select 1
          from required_runtime_functions required
          where not exists (
            select 1
            from pg_catalog.pg_proc procedure
            join pg_catalog.pg_namespace namespace
              on namespace.oid = procedure.pronamespace
            where namespace.nspname = 'public'
              and 'public.' || procedure.proname = required.function_name
          )
        ) as operation_tables_ok
  )
  select pg_catalog.jsonb_build_object(
    'database', checks.database_ok,
    'adminUsersTable', checks.admin_users_ok,
    'operationTables', checks.operation_tables_ok
  )
  from checks;
$function$;

create function public.central_user_manager_health_probe_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select private.central_user_manager_health_probe_v1_impl();
$function$;

revoke all on function
  private.central_user_manager_health_probe_v1_impl()
from public, anon, authenticated, service_role;

revoke all on function
  public.central_user_manager_health_probe_v1()
from public, anon, authenticated, service_role;

grant execute on function
  public.central_user_manager_health_probe_v1()
to service_role;

notify pgrst, 'reload schema';
