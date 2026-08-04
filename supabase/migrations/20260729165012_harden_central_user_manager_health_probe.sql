create or replace function private.central_user_manager_health_probe_v1_impl()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with required_relations(schema_name, table_name, relkind) as (
    values
      ('public'::text, 'admin_users'::text, 'r'::text),
      ('public', 'admin_user_operations', 'r'),
      ('public', 'admin_user_mutation_locks', 'r'),
      ('public', 'admin_user_mutation_fences', 'r'),
      ('public', 'admin_user_provider_events', 'r')
  ),
  required_columns(
    schema_name,
    table_name,
    column_name,
    data_type,
    not_null
  ) as (
    values
      ('public'::text, 'admin_users'::text, 'user_id'::text, 'uuid'::text, true),
      ('public', 'admin_users', 'email', 'text', true),
      ('public', 'admin_users', 'role', 'text', true),
      ('public', 'admin_users', 'is_active', 'boolean', true),
      ('public', 'admin_users', 'must_change_password', 'boolean', true),
      ('public', 'admin_users', 'credential_version', 'integer', true),
      ('public', 'admin_users', 'created_at', 'timestamp with time zone', true),
      ('public', 'admin_users', 'updated_at', 'timestamp with time zone', true),
      ('public', 'admin_user_operations', 'operation_id', 'uuid', true),
      ('public', 'admin_user_operations', 'actor_kind', 'text', true),
      ('public', 'admin_user_operations', 'actor_uid', 'uuid', true),
      ('public', 'admin_user_operations', 'action', 'text', true),
      ('public', 'admin_user_operations', 'target_user_id', 'uuid', false),
      ('public', 'admin_user_operations', 'target_email_normalized', 'text', false),
      ('public', 'admin_user_operations', 'request_hash', 'text', true),
      ('public', 'admin_user_operations', 'status', 'text', true),
      ('public', 'admin_user_operations', 'stage', 'text', true),
      ('public', 'admin_user_operations', 'fence_version', 'integer', true),
      ('public', 'admin_user_operations', 'attempt_count', 'integer', true),
      ('public', 'admin_user_operations', 'lease_token_hash', 'text', false),
      ('public', 'admin_user_operations', 'lease_expires_at', 'timestamp with time zone', false),
      ('public', 'admin_user_operations', 'provider_intent_at', 'timestamp with time zone', false),
      ('public', 'admin_user_operations', 'provider_outcome_at', 'timestamp with time zone', false),
      ('public', 'admin_user_operations', 'safe_result', 'jsonb', false),
      ('public', 'admin_user_operations', 'safe_error_code', 'text', false),
      ('public', 'admin_user_operations', 'safe_error_message', 'text', false),
      ('public', 'admin_user_operations', 'created_at', 'timestamp with time zone', true),
      ('public', 'admin_user_operations', 'updated_at', 'timestamp with time zone', true),
      ('public', 'admin_user_operations', 'completed_at', 'timestamp with time zone', false),
      ('public', 'admin_user_mutation_locks', 'target_email_normalized', 'text', true),
      ('public', 'admin_user_mutation_locks', 'operation_id', 'uuid', true),
      ('public', 'admin_user_mutation_locks', 'owner_kind', 'text', true),
      ('public', 'admin_user_mutation_locks', 'state', 'text', true),
      ('public', 'admin_user_mutation_locks', 'fence_version', 'integer', true),
      ('public', 'admin_user_mutation_locks', 'lease_token_hash', 'text', true),
      ('public', 'admin_user_mutation_locks', 'lease_expires_at', 'timestamp with time zone', true),
      ('public', 'admin_user_mutation_locks', 'quarantine_code', 'text', false),
      ('public', 'admin_user_mutation_locks', 'quarantine_reason', 'text', false),
      ('public', 'admin_user_mutation_locks', 'created_at', 'timestamp with time zone', true),
      ('public', 'admin_user_mutation_locks', 'updated_at', 'timestamp with time zone', true),
      ('public', 'admin_user_mutation_fences', 'target_email_normalized', 'text', true),
      ('public', 'admin_user_mutation_fences', 'last_fence_version', 'integer', true),
      ('public', 'admin_user_mutation_fences', 'is_quarantined', 'boolean', true),
      ('public', 'admin_user_mutation_fences', 'quarantine_code', 'text', false),
      ('public', 'admin_user_mutation_fences', 'quarantine_reason', 'text', false),
      ('public', 'admin_user_mutation_fences', 'updated_at', 'timestamp with time zone', true),
      ('public', 'admin_user_provider_events', 'operation_id', 'uuid', true),
      ('public', 'admin_user_provider_events', 'provider_step', 'text', true),
      ('public', 'admin_user_provider_events', 'step_ordinal', 'integer', true),
      ('public', 'admin_user_provider_events', 'outcome', 'text', false),
      ('public', 'admin_user_provider_events', 'target_user_id', 'uuid', false),
      ('public', 'admin_user_provider_events', 'credential_version', 'integer', false),
      ('public', 'admin_user_provider_events', 'provider_error_code', 'text', false),
      ('public', 'admin_user_provider_events', 'intent_at', 'timestamp with time zone', true),
      ('public', 'admin_user_provider_events', 'outcome_at', 'timestamp with time zone', false)
  ),
  required_routines(
    procedure_identity,
    argument_names,
    function_kind,
    return_type,
    security_definer
  ) as (
    values
      (
        'public.resume_admin_user_operation_v2(uuid,uuid,text,uuid,text,text,text,integer)'::text,
        array[
          'p_operation_id', 'p_actor_uid', 'p_action', 'p_target_user_id',
          'p_target_email_normalized', 'p_request_hash',
          'p_lease_token_hash', 'p_lease_seconds'
        ]::text[],
        'f'::text,
        'jsonb'::text,
        true
      ),
      (
        'public.renew_admin_user_operation_lease(uuid,integer,text,text,integer)',
        array[
          'p_operation_id', 'p_fence_version',
          'p_current_lease_token_hash', 'p_new_lease_token_hash',
          'p_lease_seconds'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.commit_admin_user_provider_intent_v2(uuid,integer,text,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_provider_step'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.commit_admin_user_provider_outcome_v2(uuid,integer,text,text,text,uuid,integer,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_provider_step', 'p_outcome', 'p_target_user_id',
          'p_credential_version', 'p_provider_error_code'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.complete_admin_user_operation_v2(uuid,integer,text,text,uuid,text,text,timestamp with time zone,timestamp with time zone,integer,integer,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_terminal_kind', 'p_user_id', 'p_email_normalized',
          'p_user_status', 'p_created_at', 'p_last_sign_in_at',
          'p_credential_version', 'p_auth_credential_version',
          'p_error_code'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.quarantine_admin_user_operation(uuid,integer,text,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_error_code'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.mark_admin_user_operation_needs_review(uuid,integer,text,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_error_code'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.record_admin_user_late_fence_v2(uuid,integer,integer,integer)',
        array[
          'p_operation_id', 'p_fence_version',
          'p_expected_credential_version', 'p_observed_credential_version'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.create_admin_user_profile_for_operation_v2(uuid,integer,text,uuid,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.prepare_admin_user_create_compensation_v2(uuid,integer,text,uuid,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.advance_admin_user_profile_for_operation_v2(uuid,integer,text,uuid,text,boolean,boolean,integer,boolean,boolean,integer)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_expected_is_active',
          'p_expected_must_change_password',
          'p_expected_credential_version', 'p_next_is_active',
          'p_next_must_change_password', 'p_next_credential_version'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.activate_admin_user_profile_for_operation_v2(uuid,integer,text,uuid,text,integer)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_credential_version'
        ]::text[],
        'f',
        'jsonb',
        true
      ),
      (
        'public.list_reconciled_admin_users_v1(integer,integer)',
        array['p_page', 'p_page_size']::text[],
        'f',
        'jsonb',
        true
      )
  ),
  checks as (
    select
      true as database_ok,
      not exists (
        select 1
        from required_relations required
        where required.table_name = 'admin_users'
          and not exists (
            select 1
            from pg_catalog.pg_class relation
            join pg_catalog.pg_namespace namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = required.schema_name
              and relation.relname = required.table_name
              and relation.relkind::text = required.relkind
          )
      )
      and not exists (
        select 1
        from required_columns required
        where required.table_name = 'admin_users'
          and not exists (
            select 1
            from pg_catalog.pg_attribute attribute
            join pg_catalog.pg_class relation
              on relation.oid = attribute.attrelid
            join pg_catalog.pg_namespace namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = required.schema_name
              and relation.relname = required.table_name
              and attribute.attname = required.column_name
              and attribute.attnum > 0
              and not attribute.attisdropped
              and pg_catalog.format_type(
                attribute.atttypid,
                attribute.atttypmod
              ) = required.data_type
              and attribute.attnotnull = required.not_null
          )
      ) as admin_users_ok,
      not exists (
        select 1
        from required_relations required
        where required.table_name <> 'admin_users'
          and not exists (
            select 1
            from pg_catalog.pg_class relation
            join pg_catalog.pg_namespace namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = required.schema_name
              and relation.relname = required.table_name
              and relation.relkind::text = required.relkind
          )
      )
      and not exists (
        select 1
        from required_columns required
        where required.table_name <> 'admin_users'
          and not exists (
            select 1
            from pg_catalog.pg_attribute attribute
            join pg_catalog.pg_class relation
              on relation.oid = attribute.attrelid
            join pg_catalog.pg_namespace namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = required.schema_name
              and relation.relname = required.table_name
              and attribute.attname = required.column_name
              and attribute.attnum > 0
              and not attribute.attisdropped
              and pg_catalog.format_type(
                attribute.atttypid,
                attribute.atttypmod
              ) = required.data_type
              and attribute.attnotnull = required.not_null
          )
      )
      and not exists (
        select 1
        from required_routines required
        where not exists (
          select 1
          from pg_catalog.pg_proc procedure
          where procedure.oid =
              pg_catalog.to_regprocedure(required.procedure_identity)
            and procedure.prokind::text = required.function_kind
            and procedure.prorettype =
              pg_catalog.to_regtype(required.return_type)
            and procedure.prosecdef = required.security_definer
            and procedure.proretset = false
            and procedure.proargmodes is null
            and procedure.proargnames = required.argument_names
            and pg_catalog.has_function_privilege(
              'service_role',
              procedure.oid,
              'EXECUTE'
            )
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

create or replace function public.central_user_manager_health_probe_v1()
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
