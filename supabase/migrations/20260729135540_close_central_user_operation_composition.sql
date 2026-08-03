-- Final composed privilege boundary: obsolete mutation entrypoints must not
-- remain callable after their v2 replacements exist.
revoke execute on function public.claim_admin_user_operation(uuid, text, uuid, text, uuid, text, text, text, integer) from service_role;
revoke execute on function public.resume_admin_user_operation(uuid, uuid, text, uuid, text, text, text, integer) from service_role;
revoke execute on function public.commit_admin_user_operation_stage(uuid, integer, text, text, uuid, jsonb) from service_role;
revoke execute on function public.commit_admin_user_provider_stage(uuid, integer, text, text, text, uuid, jsonb) from service_role;
revoke execute on function public.complete_admin_user_operation(uuid, integer, text, jsonb) from service_role;
revoke execute on function public.record_admin_user_late_fence(uuid, integer, integer, integer) from service_role;
revoke execute on function public.create_admin_user_profile_for_operation(uuid, integer, text, uuid, text) from service_role;
revoke execute on function public.advance_admin_user_profile_for_operation(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) from service_role;
revoke execute on function public.activate_admin_user_profile_for_operation(uuid, integer, text, uuid, text, integer) from service_role;
revoke execute on function public.claim_forced_password_change(uuid, uuid, uuid, text, text, text, integer) from service_role;

create or replace function public.commit_admin_user_provider_outcome_v2(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_provider_step text,
  p_outcome text,
  p_target_user_id uuid,
  p_credential_version integer,
  p_provider_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  if p_provider_error_code is not null
    and p_provider_error_code not in (
      'provider_timeout',
      'provider_unavailable',
      'provider_rejected',
      'provider_identity_mismatch',
      'provider_pagination_limit'
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  return private.commit_admin_user_provider_outcome_v2_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_provider_step,
    p_outcome,
    p_target_user_id,
    p_credential_version,
    p_provider_error_code
  );
end;
$$;

create or replace function public.advance_admin_user_profile_for_operation_v2(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_user_id uuid,
  p_email_normalized text,
  p_expected_is_active boolean,
  p_expected_must_change_password boolean,
  p_expected_credential_version integer,
  p_next_is_active boolean,
  p_next_must_change_password boolean,
  p_next_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_action text;
begin
  select action into strict v_action
  from public.admin_user_operations
  where operation_id = p_operation_id;

  if v_action = 'suspend_user'
    and p_next_must_change_password is distinct from
      p_expected_must_change_password
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  return private.advance_admin_user_profile_for_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_user_id,
    p_email_normalized, p_expected_is_active,
    p_expected_must_change_password, p_expected_credential_version,
    p_next_is_active, p_next_must_change_password,
    p_next_credential_version
  );
end;
$$;

create or replace function private.complete_admin_user_operation_v3_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_terminal_kind text,
  p_user_id uuid,
  p_email_normalized text,
  p_user_status text,
  p_created_at timestamptz,
  p_last_sign_in_at timestamptz,
  p_credential_version integer,
  p_auth_credential_version integer,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_profile public.admin_users%rowtype;
  v_expected_status text;
  v_target_email_normalized text;
begin
  if p_operation_id is null
    or p_fence_version is null or p_fence_version <= 0
    or p_lease_token_hash is null or p_lease_token_hash = ''
    or p_terminal_kind is null
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized into strict v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;
  perform pg_advisory_xact_lock(
    hashtextextended(v_target_email_normalized, 0)
  );
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if p_terminal_kind in ('success', 'duplicate') then
    if p_user_id is null
      or p_email_normalized is null
      or p_email_normalized is distinct from lower(btrim(p_email_normalized))
      or p_user_status is null
      or p_user_status not in (
        'active', 'password_change_required', 'suspended'
      )
      or p_created_at is null
      or p_credential_version is null or p_credential_version <= 0
      or p_auth_credential_version is null
      or p_auth_credential_version <= 0
      or p_credential_version is distinct from p_auth_credential_version
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;

    select * into strict v_profile
    from public.admin_users
    where user_id = p_user_id
      and email = p_email_normalized;

    v_expected_status := case
      when not v_profile.is_active then 'suspended'
      when v_profile.must_change_password then 'password_change_required'
      else 'active'
    end;

    if v_profile.credential_version is distinct from p_credential_version
      or v_expected_status is distinct from p_user_status
      or v_operation.target_email_normalized is distinct from
        p_email_normalized
      or (
        v_operation.target_user_id is not null
        and v_operation.target_user_id is distinct from p_user_id
      )
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  end if;

  if p_terminal_kind = 'success' and (
    p_error_code is not null
    or v_operation.action not in (
      'create_user', 'reissue_temporary_password',
      'suspend_user', 'reactivate_user'
    )
    or v_operation.stage is distinct from case v_operation.action
      when 'create_user' then 'profile_created'
      when 'reissue_temporary_password' then 'global_signout_succeeded'
      when 'suspend_user' then 'auth_update_succeeded'
      when 'reactivate_user' then 'profile_activated'
    end
    or (
      v_operation.action in (
        'create_user', 'reissue_temporary_password', 'reactivate_user'
      )
      and (
        v_profile.is_active is distinct from true
        or v_profile.must_change_password is distinct from true
      )
    )
    or (
      v_operation.action = 'suspend_user'
      and v_profile.is_active is distinct from false
    )
  ) then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  elsif p_terminal_kind = 'duplicate' and (
    v_operation.action is distinct from 'create_user'
    or v_operation.stage is distinct from 'claimed'
    or p_error_code is distinct from 'user_exists'
  ) then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  elsif p_terminal_kind = 'compensated' and (
    v_operation.action is distinct from 'create_user'
    or v_operation.stage is distinct from 'auth_delete_succeeded'
    or p_error_code is distinct from 'create_compensated'
    or p_user_id is not null or p_email_normalized is not null
    or p_user_status is not null or p_created_at is not null
    or p_last_sign_in_at is not null
    or p_credential_version is not null
    or p_auth_credential_version is not null
  ) then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  elsif p_terminal_kind not in ('success', 'duplicate', 'compensated') then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  return private.complete_admin_user_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_terminal_kind,
    p_user_id, p_email_normalized, p_user_status, p_created_at,
    p_last_sign_in_at, p_credential_version, p_auth_credential_version,
    p_error_code
  );
end;
$$;

create or replace function public.complete_admin_user_operation_v2(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_terminal_kind text,
  p_user_id uuid,
  p_email_normalized text,
  p_user_status text,
  p_created_at timestamptz,
  p_last_sign_in_at timestamptz,
  p_credential_version integer,
  p_auth_credential_version integer,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.complete_admin_user_operation_v3_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_terminal_kind,
    p_user_id, p_email_normalized, p_user_status, p_created_at,
    p_last_sign_in_at, p_credential_version, p_auth_credential_version,
    p_error_code
  );
end;
$$;

create or replace function public.claim_forced_password_change_v2(
  p_operation_id uuid,
  p_actor_uid uuid,
  p_target_user_id uuid,
  p_target_email_normalized text,
  p_request_hash text,
  p_lease_token_hash text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where user_id = p_target_user_id
      and email = p_target_email_normalized
  ) then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  return private.resume_admin_user_operation_v2_impl(
    p_operation_id, p_actor_uid, 'complete_password_change',
    p_target_user_id, p_target_email_normalized, p_request_hash,
    p_lease_token_hash, p_lease_seconds
  );
end;
$$;

revoke all on function private.complete_admin_user_operation_v3_impl(uuid, integer, text, text, uuid, text, text, timestamptz, timestamptz, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.claim_forced_password_change_v2(uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_forced_password_change_v2(uuid, uuid, uuid, text, text, text, integer) to service_role;
