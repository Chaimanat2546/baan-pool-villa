create or replace function private.complete_forced_password_change_v2_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_user_id uuid,
  p_email_normalized text,
  p_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_operation_id is null
    or p_fence_version is null
    or p_fence_version <= 0
    or p_lease_token_hash is null
    or p_lease_token_hash !~ '^[0-9a-f]{64}$'
    or p_user_id is null
    or p_email_normalized is null
    or p_email_normalized is distinct from lower(btrim(p_email_normalized))
    or p_credential_version is null
    or p_credential_version <= 2
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if not found
    or v_operation.actor_kind is distinct from 'target_admin'
    or v_operation.actor_uid is distinct from p_user_id
    or v_operation.action is distinct from 'complete_password_change'
    or v_operation.target_user_id is distinct from p_user_id
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or v_operation.status is distinct from 'leased'
    or v_operation.stage is distinct from 'auth_n2_aligned'
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  perform 1 from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and state = 'leased'
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and lease_expires_at > v_now
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  update public.admin_users
  set must_change_password = false
  where user_id = p_user_id
    and email = p_email_normalized
    and is_active = true
    and must_change_password = true
    and credential_version = p_credential_version;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  update public.admin_user_operations
  set status = 'completed',
      stage = 'completed',
      safe_result = jsonb_build_object(
        'outcome', 'password_changed',
        'credentialVersion', p_credential_version
      ),
      lease_token_hash = null,
      lease_expires_at = null,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  delete from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function private.release_forced_password_change_v2_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_user_id uuid,
  p_email_normalized text,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_operation_id is null
    or p_fence_version is null
    or p_fence_version <= 0
    or p_lease_token_hash is null
    or p_lease_token_hash !~ '^[0-9a-f]{64}$'
    or p_user_id is null
    or p_email_normalized is null
    or p_email_normalized is distinct from lower(btrim(p_email_normalized))
    or p_stage is distinct from 'temporary_password_rejected'
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  if not found
    or v_operation.actor_kind is distinct from 'target_admin'
    or v_operation.actor_uid is distinct from p_user_id
    or v_operation.action is distinct from 'complete_password_change'
    or v_operation.target_user_id is distinct from p_user_id
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or v_operation.status is distinct from 'leased'
    or v_operation.stage is distinct from 'claimed'
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  perform 1 from public.admin_users
  where user_id = p_user_id
    and email = p_email_normalized
    and is_active = true
    and must_change_password = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  delete from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and state = 'leased'
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash;
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  update public.admin_user_operations
  set status = 'completed',
      stage = p_stage,
      safe_result = jsonb_build_object('outcome', 'rejected'),
      lease_token_hash = null,
      lease_expires_at = null,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;
  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function private.rollback_forced_password_change_v2_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_user_id uuid,
  p_email_normalized text,
  p_expected_credential_version integer,
  p_next_credential_version integer,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_expected_stage text;
  v_now timestamptz := clock_timestamp();
begin
  if p_operation_id is null
    or p_fence_version is null
    or p_fence_version <= 0
    or p_lease_token_hash is null
    or p_lease_token_hash !~ '^[0-9a-f]{64}$'
    or p_user_id is null
    or p_email_normalized is null
    or p_email_normalized is distinct from lower(btrim(p_email_normalized))
    or p_expected_credential_version is null
    or p_next_credential_version is distinct from
      p_expected_credential_version - 1
    or p_next_credential_version <= 0
    or p_stage not in ('auth_n1_rejected', 'auth_n2_rejected')
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;
  v_expected_stage := case p_stage
    when 'auth_n1_rejected' then 'profile_n1'
    else 'profile_n2'
  end;

  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  if not found
    or v_operation.actor_kind is distinct from 'target_admin'
    or v_operation.actor_uid is distinct from p_user_id
    or v_operation.action is distinct from 'complete_password_change'
    or v_operation.target_user_id is distinct from p_user_id
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or v_operation.status is distinct from 'leased'
    or v_operation.stage is distinct from v_expected_stage
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  perform 1 from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and state = 'leased'
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and lease_expires_at > v_now
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  update public.admin_users
  set credential_version = p_next_credential_version
  where user_id = p_user_id
    and email = p_email_normalized
    and is_active = true
    and must_change_password = true
    and credential_version = p_expected_credential_version;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  delete from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash;
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  update public.admin_user_operations
  set status = 'completed',
      stage = p_stage,
      safe_result = jsonb_build_object(
        'outcome', 'provider_rejected',
        'credentialVersion', p_next_credential_version
      ),
      lease_token_hash = null,
      lease_expires_at = null,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;
  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.complete_forced_password_change_v2(
  p_operation_id uuid, p_fence_version integer, p_lease_token_hash text,
  p_user_id uuid, p_email_normalized text, p_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.complete_forced_password_change_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_user_id,
    p_email_normalized, p_credential_version
  );
end;
$$;

create or replace function public.release_forced_password_change_v2(
  p_operation_id uuid, p_fence_version integer, p_lease_token_hash text,
  p_user_id uuid, p_email_normalized text, p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.release_forced_password_change_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_user_id,
    p_email_normalized, p_stage
  );
end;
$$;

create or replace function public.rollback_forced_password_change_v2(
  p_operation_id uuid, p_fence_version integer, p_lease_token_hash text,
  p_user_id uuid, p_email_normalized text,
  p_expected_credential_version integer, p_next_credential_version integer,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.rollback_forced_password_change_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_user_id,
    p_email_normalized, p_expected_credential_version,
    p_next_credential_version, p_stage
  );
end;
$$;

revoke all on function private.complete_forced_password_change_v2_impl(uuid, integer, text, uuid, text, integer) from public, anon, authenticated, service_role;
revoke all on function private.release_forced_password_change_v2_impl(uuid, integer, text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.rollback_forced_password_change_v2_impl(uuid, integer, text, uuid, text, integer, integer, text) from public, anon, authenticated, service_role;

revoke all on function public.complete_forced_password_change_v2(uuid, integer, text, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.release_forced_password_change_v2(uuid, integer, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.rollback_forced_password_change_v2(uuid, integer, text, uuid, text, integer, integer, text) from public, anon, authenticated;

grant execute on function public.complete_forced_password_change_v2(uuid, integer, text, uuid, text, integer) to service_role;
grant execute on function public.release_forced_password_change_v2(uuid, integer, text, uuid, text, text) to service_role;
grant execute on function public.rollback_forced_password_change_v2(uuid, integer, text, uuid, text, integer, integer, text) to service_role;

create or replace function
  private.central_user_manager_forced_password_health_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with required_routines(procedure_identity, argument_names) as (
    values
      (
        'public.complete_forced_password_change_v2(uuid,integer,text,uuid,text,integer)'::text,
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_credential_version'
        ]::text[]
      ),
      (
        'public.release_forced_password_change_v2(uuid,integer,text,uuid,text,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized', 'p_stage'
        ]::text[]
      ),
      (
        'public.rollback_forced_password_change_v2(uuid,integer,text,uuid,text,integer,integer,text)',
        array[
          'p_operation_id', 'p_fence_version', 'p_lease_token_hash',
          'p_user_id', 'p_email_normalized',
          'p_expected_credential_version', 'p_next_credential_version',
          'p_stage'
        ]::text[]
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
      where pg_catalog.format(
          '%I.%I(%s)',
          namespace.nspname,
          routine.proname,
          pg_catalog.pg_get_function_identity_arguments(routine.oid)
        ) = required.procedure_identity
        and routine.proargnames = required.argument_names
        and routine.prokind = 'f'
        and pg_catalog.format_type(routine.prorettype, null) = 'jsonb'
        and routine.prosecdef = true
        and pg_catalog.has_function_privilege(
          'service_role',
          routine.oid,
          'EXECUTE'
        )
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
  ),
  forced_password as (
    select private.central_user_manager_forced_password_health_v1() as ok
  )
  select base.probe || pg_catalog.jsonb_build_object(
    'operationTables',
    coalesce(
      (base.probe ->> 'operationTables')::pg_catalog.bool,
      false
    ) and checkpoint.ok and forced_password.ok
  )
  from base
  cross join checkpoint
  cross join forced_password;
$function$;

revoke all on function
  private.central_user_manager_forced_password_health_v1()
from public, anon, authenticated, service_role;

revoke all on function
  public.central_user_manager_health_probe_v1()
from public, anon, authenticated, service_role;

grant execute on function
  public.central_user_manager_health_probe_v1()
to service_role;

notify pgrst, 'reload schema';
