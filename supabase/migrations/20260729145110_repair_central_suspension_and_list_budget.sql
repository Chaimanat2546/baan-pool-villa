alter table public.admin_user_operations
  rename column suspension_expected_must_change_password
  to suspension_expected_forced_flag;
alter table public.admin_user_provider_events
  rename column suspension_expected_must_change_password
  to suspension_expected_forced_flag;

create or replace function private.advance_admin_user_profile_for_operation_v2_impl(
  p_operation_id uuid, p_fence_version integer,
  p_lease_token_hash text, p_user_id uuid, p_email_normalized text,
  p_expected_is_active boolean, p_expected_must_change_password boolean,
  p_expected_credential_version integer, p_next_is_active boolean,
  p_next_must_change_password boolean, p_next_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_profile public.admin_users%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_email_normalized is null
    or p_expected_credential_version is null
    or p_expected_credential_version <= 0
    or p_next_credential_version is distinct from
      p_expected_credential_version + 1
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into strict v_operation from public.admin_user_operations
  where operation_id = p_operation_id for update;
  if v_operation.action not in (
      'reissue_temporary_password', 'suspend_user', 'reactivate_user'
    )
    or v_operation.stage is distinct from 'claimed'
    or v_operation.status is distinct from 'leased'
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or (
      v_operation.target_user_id is not null
      and v_operation.target_user_id is distinct from p_user_id
    )
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  if (
      v_operation.action = 'reissue_temporary_password'
      and (
        p_expected_is_active is distinct from true
        or p_next_is_active is distinct from true
        or p_next_must_change_password is distinct from true
      )
    ) or (
      v_operation.action = 'suspend_user'
      and (
        p_expected_is_active is distinct from true
        or p_next_is_active is distinct from false
        or p_next_must_change_password is distinct from
          p_expected_must_change_password
      )
    ) or (
      v_operation.action = 'reactivate_user'
      and (
        p_expected_is_active is distinct from false
        or p_next_is_active is distinct from false
        or p_next_must_change_password is distinct from true
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  perform 1 from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and state = 'leased'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;
  update public.admin_users
  set is_active = p_next_is_active,
      must_change_password = p_next_must_change_password,
      credential_version = p_next_credential_version
  where user_id = p_user_id
    and email = p_email_normalized
    and is_active = p_expected_is_active
    and must_change_password = p_expected_must_change_password
    and credential_version = p_expected_credential_version
  returning * into v_profile;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  update public.admin_user_operations
  set target_user_id = p_user_id,
      status = 'leased',
      stage = 'profile_advanced',
      suspension_expected_forced_flag = case
        when action = 'suspend_user'
          then p_expected_must_change_password
        else null
      end,
      safe_result = jsonb_build_object(
        'userId', p_user_id,
        'credentialVersion', p_next_credential_version,
        'profileIsActive', p_next_is_active,
        'profileForcedFlag', p_next_must_change_password
      ),
      updated_at = v_now
  where operation_id = p_operation_id;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.advance_admin_user_profile_for_operation_v2(
  p_operation_id uuid, p_fence_version integer,
  p_lease_token_hash text, p_user_id uuid, p_email_normalized text,
  p_expected_is_active boolean, p_expected_must_change_password boolean,
  p_expected_credential_version integer, p_next_is_active boolean,
  p_next_must_change_password boolean, p_next_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.advance_admin_user_profile_for_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_user_id,
    p_email_normalized, p_expected_is_active,
    p_expected_must_change_password, p_expected_credential_version,
    p_next_is_active, p_next_must_change_password,
    p_next_credential_version
  );
end;
$$;

create or replace function public.commit_admin_user_provider_outcome_v2(
  p_operation_id uuid, p_fence_version integer,
  p_lease_token_hash text, p_provider_step text, p_outcome text,
  p_target_user_id uuid, p_credential_version integer,
  p_provider_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_result jsonb;
  v_operation public.admin_user_operations%rowtype;
begin
  if p_provider_error_code is not null
    and p_provider_error_code not in (
      'provider_timeout', 'provider_unavailable', 'provider_rejected',
      'provider_identity_mismatch', 'provider_pagination_limit'
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;
  v_result := private.commit_admin_user_provider_outcome_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_provider_step, p_outcome, p_target_user_id,
    p_credential_version, p_provider_error_code
  );
  select * into strict v_operation from public.admin_user_operations
  where operation_id = p_operation_id for update;
  if v_operation.action = 'suspend_user'
    and p_provider_step = 'auth_update'
  then
    if v_operation.suspension_expected_forced_flag is null then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
    update public.admin_user_provider_events
    set suspension_expected_forced_flag =
          v_operation.suspension_expected_forced_flag
    where operation_id = p_operation_id
      and provider_step = p_provider_step;
    update public.admin_user_operations
    set safe_result = coalesce(safe_result, '{}'::jsonb) ||
      jsonb_build_object(
        'suspensionExpectedForcedFlag',
        suspension_expected_forced_flag
      )
    where operation_id = p_operation_id
    returning * into strict v_operation;
    return private.admin_user_operation_record(v_operation);
  end if;
  return v_result;
end;
$$;

create or replace function private.complete_admin_user_operation_v4_impl(
  p_operation_id uuid, p_fence_version integer,
  p_lease_token_hash text, p_terminal_kind text, p_user_id uuid,
  p_email_normalized text, p_user_status text,
  p_created_at timestamptz, p_last_sign_in_at timestamptz,
  p_credential_version integer, p_auth_credential_version integer,
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
  v_now timestamptz := clock_timestamp();
  v_target_email_normalized text;
begin
  if p_terminal_kind in ('success', 'duplicate') and (
    p_created_at is null or not isfinite(p_created_at)
    or p_created_at < timestamptz '2000-01-01 00:00:00+00'
    or p_created_at > v_now + interval '5 minutes'
    or (
      p_last_sign_in_at is not null
      and (
        not isfinite(p_last_sign_in_at)
        or p_last_sign_in_at < p_created_at
        or p_last_sign_in_at > v_now + interval '5 minutes'
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;
  select target_email_normalized into strict v_target_email_normalized
  from public.admin_user_operations where operation_id = p_operation_id;
  perform pg_advisory_xact_lock(
    hashtextextended(v_target_email_normalized, 0)
  );
  select * into strict v_operation from public.admin_user_operations
  where operation_id = p_operation_id;
  if v_operation.action = 'suspend_user'
    and p_terminal_kind = 'success'
  then
    select * into strict v_profile from public.admin_users
    where user_id = p_user_id and email = p_email_normalized;
    if v_operation.suspension_expected_forced_flag is null
      or v_profile.must_change_password is distinct from
        v_operation.suspension_expected_forced_flag
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  end if;
  return private.complete_admin_user_operation_v3_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_terminal_kind, p_user_id, p_email_normalized, p_user_status,
    p_created_at, p_last_sign_in_at, p_credential_version,
    p_auth_credential_version, p_error_code
  );
end;
$$;

revoke all on function private.advance_admin_user_profile_for_operation_v2_impl(
  uuid, integer, text, uuid, text, boolean, boolean, integer,
  boolean, boolean, integer
) from public, anon, authenticated, service_role;

revoke all on function private.complete_admin_user_operation_v4_impl(
  uuid, integer, text, text, uuid, text, text, timestamptz,
  timestamptz, integer, integer, text
) from public, anon, authenticated, service_role;
