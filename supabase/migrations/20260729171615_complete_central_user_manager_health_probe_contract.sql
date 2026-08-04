create or replace function
  private.central_user_manager_suspension_checkpoint_health_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with required_columns(
    schema_name,
    table_name,
    column_name,
    data_type,
    not_null
  ) as (
    values
      ('public'::text, 'admin_user_operations'::text, 'suspension_expected_forced_flag'::text, 'boolean'::text, false),
      ('public', 'admin_user_provider_events', 'suspension_expected_forced_flag', 'boolean', false)
  )
  select not exists (
    select 1
    from required_columns required
    where not exists (
      select 1
      from pg_catalog.pg_attribute attribute
      join pg_catalog.pg_class relation
        on relation.oid = attribute.attrelid
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = required.schema_name
        and relation.relname = required.table_name
        and relation.relkind::text = 'r'
        and attribute.attname = required.column_name
        and attribute.attnum > 0
        and not attribute.attisdropped
        and pg_catalog.format_type(
          attribute.atttypid,
          attribute.atttypmod
        ) = required.data_type
        and attribute.attnotnull = required.not_null
    )
  );
$function$;

create or replace function public.central_user_manager_health_probe_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with base as (
    select private.central_user_manager_health_probe_v1_impl() as probe
  ),
  checkpoint as (
    select
      private.central_user_manager_suspension_checkpoint_health_v1() as ok
  )
  select base.probe || pg_catalog.jsonb_build_object(
    'operationTables',
    coalesce(
      (base.probe ->> 'operationTables')::pg_catalog.bool,
      false
    ) and checkpoint.ok
  )
  from base
  cross join checkpoint;
$function$;

revoke all on function
  private.central_user_manager_suspension_checkpoint_health_v1()
from public, anon, authenticated, service_role;

revoke all on function
  public.central_user_manager_health_probe_v1()
from public, anon, authenticated, service_role;

grant execute on function
  public.central_user_manager_health_probe_v1()
to service_role;

notify pgrst, 'reload schema';
