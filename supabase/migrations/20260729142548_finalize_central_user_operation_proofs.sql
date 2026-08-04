alter table public.admin_user_operations
  add column suspension_expected_must_change_password boolean;

alter table public.admin_user_provider_events
  add column suspension_expected_must_change_password boolean,
  add constraint admin_user_provider_events_suspension_checkpoint check (
    suspension_expected_must_change_password is null
    or provider_step = 'auth_update'
  );

create or replace function private.claim_forced_password_change_v2_impl(
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
declare
  v_operation public.admin_user_operations%rowtype;
  v_lock public.admin_user_mutation_locks%rowtype;
  v_result jsonb;
  v_next_fence integer;
  v_now timestamptz := clock_timestamp();
  v_lease_expires_at timestamptz;
begin
  if p_operation_id is null
    or p_actor_uid is distinct from p_target_user_id
    or p_target_email_normalized is null
    or p_target_email_normalized is distinct from
      lower(btrim(p_target_email_normalized))
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_lease_token_hash !~ '^[0-9a-f]{64}$'
    or p_lease_seconds is null
    or p_lease_seconds not between 1 and 300
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_target_email_normalized, 0)
  );
  perform 1 from public.admin_users
  where user_id = p_target_user_id
    and email = p_target_email_normalized;
  if not found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  insert into public.admin_user_mutation_fences (
    target_email_normalized, last_fence_version
  ) values (p_target_email_normalized, 1)
  on conflict (target_email_normalized) do nothing;
  perform 1 from public.admin_user_mutation_fences
  where target_email_normalized = p_target_email_normalized
    and is_quarantined = true
  for update;
  if found then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  select * into v_operation from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if not found then
    v_result := private.claim_admin_user_operation_impl(
      p_operation_id, 'target_admin', p_actor_uid,
      'complete_password_change', p_target_user_id,
      p_target_email_normalized, p_request_hash,
      p_lease_token_hash, p_lease_seconds
    );
    if not (v_result ->> 'lease_token_accepted')::boolean then
      return v_result;
    end if;
    select * into strict v_operation from public.admin_user_operations
    where operation_id = p_operation_id for update;
  else
    if v_operation.actor_kind is distinct from 'target_admin'
      or v_operation.actor_uid is distinct from p_actor_uid
      or v_operation.action is distinct from 'complete_password_change'
      or v_operation.target_user_id is distinct from p_target_user_id
      or v_operation.target_email_normalized is distinct from
        p_target_email_normalized
      or v_operation.request_hash is distinct from p_request_hash
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
    if v_operation.status = 'completed' then
      return jsonb_build_object(
        'operation', private.admin_user_operation_record(v_operation),
        'disposition', 'completed_retry',
        'lease_token_accepted', false
      );
    end if;
    if v_operation.status in ('quarantined', 'needs_review') then
      raise exception using errcode = 'P0001', message = 'operation_quarantined';
    end if;
    select * into v_lock from public.admin_user_mutation_locks
    where target_email_normalized = p_target_email_normalized
      and operation_id = p_operation_id
      and owner_kind = 'password_change'
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'lease_conflict';
    end if;
    if v_operation.lease_expires_at > v_now
      and v_lock.lease_expires_at > v_now
    then
      return jsonb_build_object(
        'operation', private.admin_user_operation_record(v_operation),
        'disposition', 'exact_retry',
        'lease_token_accepted', false
      );
    end if;
    if v_operation.status is distinct from 'leased'
      or v_lock.state is distinct from 'leased'
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
    v_result := null;
  end if;

  update public.admin_user_mutation_fences
  set last_fence_version = greatest(
        last_fence_version, v_operation.fence_version
      ) + 1,
      updated_at = v_now
  where target_email_normalized = p_target_email_normalized
  returning last_fence_version into strict v_next_fence;
  v_lease_expires_at := v_now + make_interval(secs => p_lease_seconds);
  update public.admin_user_mutation_locks
  set fence_version = v_next_fence,
      lease_token_hash = p_lease_token_hash,
      lease_expires_at = v_lease_expires_at,
      updated_at = v_now
  where target_email_normalized = p_target_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and state = 'leased';
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;
  update public.admin_user_operations
  set fence_version = v_next_fence,
      attempt_count = case when v_result is null
        then attempt_count + 1 else attempt_count end,
      lease_token_hash = p_lease_token_hash,
      lease_expires_at = v_lease_expires_at,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;
  return jsonb_build_object(
    'operation', private.admin_user_operation_record(v_operation),
    'disposition', 'first_claim',
    'lease_token_accepted', true
  );
end;
$$;

create or replace function public.claim_forced_password_change_v2(
  p_operation_id uuid, p_actor_uid uuid, p_target_user_id uuid,
  p_target_email_normalized text, p_request_hash text,
  p_lease_token_hash text, p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.claim_forced_password_change_v2_impl(
    p_operation_id, p_actor_uid, p_target_user_id,
    p_target_email_normalized, p_request_hash,
    p_lease_token_hash, p_lease_seconds
  );
end;
$$;

create or replace function public.advance_admin_user_profile_for_operation_v2(
  p_operation_id uuid, p_fence_version integer,
  p_lease_token_hash text, p_user_id uuid, p_email_normalized text,
  p_expected_is_active boolean,
  p_expected_must_change_password boolean,
  p_expected_credential_version integer, p_next_is_active boolean,
  p_next_must_change_password boolean, p_next_credential_version integer
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
  v_result := private.advance_admin_user_profile_for_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash, p_user_id,
    p_email_normalized, p_expected_is_active,
    p_expected_must_change_password, p_expected_credential_version,
    p_next_is_active, p_next_must_change_password,
    p_next_credential_version
  );
  select * into strict v_operation from public.admin_user_operations
  where operation_id = p_operation_id for update;
  if v_operation.action = 'suspend_user' then
    update public.admin_user_operations
    set suspension_expected_must_change_password =
          p_expected_must_change_password
    where operation_id = p_operation_id
    returning * into strict v_operation;
    return private.admin_user_operation_record(v_operation);
  end if;
  return v_result;
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
    if v_operation.suspension_expected_must_change_password is null then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
    update public.admin_user_provider_events
    set suspension_expected_must_change_password =
          v_operation.suspension_expected_must_change_password
    where operation_id = p_operation_id
      and provider_step = p_provider_step;
    update public.admin_user_operations
    set safe_result = coalesce(safe_result, '{}'::jsonb) ||
      jsonb_build_object(
        'suspensionExpectedMustChangePassword',
        suspension_expected_must_change_password
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
    p_created_at is null
    or not isfinite(p_created_at)
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
  from public.admin_user_operations
  where operation_id = p_operation_id;
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
    if v_operation.suspension_expected_must_change_password is null
      or v_profile.must_change_password is distinct from
        v_operation.suspension_expected_must_change_password
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

create or replace function public.complete_admin_user_operation_v2(
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
begin
  return private.complete_admin_user_operation_v4_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_terminal_kind, p_user_id, p_email_normalized, p_user_status,
    p_created_at, p_last_sign_in_at, p_credential_version,
    p_auth_credential_version, p_error_code
  );
end;
$$;

revoke all on function private.claim_forced_password_change_v2_impl(uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function private.complete_admin_user_operation_v4_impl(uuid, integer, text, text, uuid, text, text, timestamptz, timestamptz, integer, integer, text) from public, anon, authenticated, service_role;
