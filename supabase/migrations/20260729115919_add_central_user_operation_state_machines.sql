create or replace function private.resume_admin_user_operation_impl(
  p_operation_id uuid,
  p_actor_uid uuid,
  p_action text,
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
  v_now timestamptz := clock_timestamp();
  v_lease_expires_at timestamptz;
begin
  if p_action not in (
      'create_user',
      'reissue_temporary_password',
      'suspend_user',
      'reactivate_user'
    )
    or p_target_email_normalized is null
    or p_target_email_normalized <> lower(btrim(p_target_email_normalized))
    or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_lease_token_hash !~ '^[0-9a-f]{64}$'
    or p_lease_seconds is null
    or p_lease_seconds < 1
    or p_lease_seconds > 300
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target_email_normalized, 0));

  select *
  into v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if not found then
    return private.claim_admin_user_operation_impl(
      p_operation_id,
      'central_admin',
      p_actor_uid,
      p_action,
      p_target_user_id,
      p_target_email_normalized,
      p_request_hash,
      p_lease_token_hash,
      p_lease_seconds
    );
  end if;

  if v_operation.actor_kind <> 'central_admin'
    or v_operation.actor_uid <> p_actor_uid
    or v_operation.action <> p_action
    or v_operation.target_email_normalized <> p_target_email_normalized
    or v_operation.request_hash <> p_request_hash
    or (
      p_target_user_id is not null
      and v_operation.target_user_id is distinct from p_target_user_id
    )
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
    return jsonb_build_object(
      'operation', private.admin_user_operation_record(v_operation),
      'disposition', 'exact_retry',
      'lease_token_accepted', false
    );
  end if;

  select *
  into v_lock
  from public.admin_user_mutation_locks
  where target_email_normalized = p_target_email_normalized
  for update;

  if not found or v_lock.operation_id <> p_operation_id then
    raise exception using errcode = 'P0001', message = 'lease_conflict';
  end if;

  if v_lock.state = 'quarantined' then
    update public.admin_user_operations
    set status = 'quarantined',
        stage = 'quarantined',
        safe_error_code = coalesce(v_lock.quarantine_code, 'operation_quarantined'),
        safe_error_message = coalesce(
          v_lock.quarantine_reason,
          'The operation is permanently quarantined.'
        ),
        lease_token_hash = null,
        lease_expires_at = null,
        updated_at = v_now
    where operation_id = p_operation_id
    returning * into strict v_operation;

    return jsonb_build_object(
      'operation', private.admin_user_operation_record(v_operation),
      'disposition', 'exact_retry',
      'lease_token_accepted', false
    );
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

  if v_operation.status = 'provider_intent' then
    update public.admin_user_mutation_locks
    set state = 'quarantined',
        quarantine_code = 'provider_ambiguous',
        quarantine_reason = 'Provider outcome is ambiguous.',
        updated_at = v_now
    where target_email_normalized = p_target_email_normalized
      and operation_id = p_operation_id;

    update public.admin_user_operations
    set status = 'quarantined',
        stage = 'quarantined',
        safe_error_code = 'provider_ambiguous',
        safe_error_message = 'Provider outcome is ambiguous.',
        lease_token_hash = null,
        lease_expires_at = null,
        updated_at = v_now
    where operation_id = p_operation_id
    returning * into strict v_operation;

    return jsonb_build_object(
      'operation', private.admin_user_operation_record(v_operation),
      'disposition', 'exact_retry',
      'lease_token_accepted', false
    );
  end if;

  if v_operation.status not in ('leased', 'provider_outcome') then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  v_lease_expires_at := v_now + make_interval(secs => p_lease_seconds);

  update public.admin_user_mutation_locks
  set fence_version = fence_version + 1,
      lease_token_hash = p_lease_token_hash,
      lease_expires_at = v_lease_expires_at,
      updated_at = v_now
  where target_email_normalized = p_target_email_normalized
    and operation_id = p_operation_id
    and state = 'leased'
  returning * into strict v_lock;

  update public.admin_user_operations
  set fence_version = v_lock.fence_version,
      attempt_count = attempt_count + 1,
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

create or replace function public.resume_admin_user_operation(
  p_operation_id uuid,
  p_actor_uid uuid,
  p_action text,
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
  return private.resume_admin_user_operation_impl(
    p_operation_id,
    p_actor_uid,
    p_action,
    p_target_user_id,
    p_target_email_normalized,
    p_request_hash,
    p_lease_token_hash,
    p_lease_seconds
  );
end;
$$;

create or replace function private.commit_admin_user_provider_stage_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_provider_step text,
  p_stage text,
  p_target_user_id uuid,
  p_safe_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_target_email_normalized text;
  v_now timestamptz := clock_timestamp();
begin
  if p_provider_step not in (
      'auth_create',
      'auth_delete',
      'auth_update',
      'password_verify',
      'global_signout'
    )
    or p_stage not in ('intent', 'outcome')
    or (
      p_safe_result is not null
      and not private.admin_user_safe_json(p_safe_result)
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into strict v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  perform pg_advisory_xact_lock(
    hashtextextended(v_target_email_normalized, 0)
  );

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.status in ('quarantined', 'needs_review', 'completed') then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  if v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  perform 1
  from public.admin_user_mutation_locks
  where target_email_normalized = v_operation.target_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and state = 'leased'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  if (
      p_stage = 'intent'
      and v_operation.status not in ('leased', 'provider_outcome')
    )
    or (
      p_stage = 'outcome'
      and v_operation.status <> 'provider_intent'
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if p_stage = 'intent' and p_safe_result is not null then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if p_stage = 'outcome' and (
      p_safe_result is null
      or p_safe_result ->> 'providerStep' <> p_provider_step
      or p_safe_result ->> 'outcome' not in ('succeeded', 'rejected')
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if p_target_user_id is not null then
    if v_operation.target_user_id is not null
      and v_operation.target_user_id <> p_target_user_id
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    elsif v_operation.target_user_id is null
      and not (
        v_operation.action = 'create_user'
        and p_provider_step = 'auth_create'
        and p_stage = 'outcome'
      )
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  end if;

  update public.admin_user_operations
  set status = case
        when p_stage = 'intent' then 'provider_intent'
        else 'provider_outcome'
      end,
      stage = case
        when p_stage = 'intent' then 'provider_intent'
        else 'provider_outcome'
      end,
      target_user_id = case
        when target_user_id is null
          and action = 'create_user'
          and p_provider_step = 'auth_create'
          and p_stage = 'outcome'
        then p_target_user_id
        else target_user_id
      end,
      safe_result = case
        when p_stage = 'outcome' then p_safe_result
        else safe_result
      end,
      provider_intent_at = case
        when p_stage = 'intent' then v_now
        else provider_intent_at
      end,
      provider_outcome_at = case
        when p_stage = 'outcome' then v_now
        else provider_outcome_at
      end,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.commit_admin_user_provider_stage(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_provider_step text,
  p_stage text,
  p_target_user_id uuid,
  p_safe_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.commit_admin_user_provider_stage_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_provider_step,
    p_stage,
    p_target_user_id,
    p_safe_result
  );
end;
$$;

create or replace function private.mark_admin_user_operation_needs_review_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_target_email_normalized text;
  v_now timestamptz := clock_timestamp();
  v_error_message text;
begin
  v_error_message := case p_error_code
    when 'identity_mismatch' then 'The Auth user and admin profile do not match.'
    when 'profile_write_failed' then 'Unable to update the admin profile.'
    when 'profile_state_conflict' then 'Admin profile state changed.'
    else null
  end;

  if v_error_message is null then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into strict v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  perform pg_advisory_xact_lock(
    hashtextextended(v_target_email_normalized, 0)
  );

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  update public.admin_user_mutation_locks
  set state = 'quarantined',
      quarantine_code = p_error_code,
      quarantine_reason = v_error_message,
      updated_at = v_now
  where target_email_normalized = v_operation.target_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash;

  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  update public.admin_user_operations
  set status = 'needs_review',
      stage = 'needs_review',
      safe_error_code = p_error_code,
      safe_error_message = v_error_message,
      lease_token_hash = null,
      lease_expires_at = null,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.mark_admin_user_operation_needs_review(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.mark_admin_user_operation_needs_review_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_error_code
  );
end;
$$;

create or replace function private.record_admin_user_late_fence_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_expected_credential_version integer,
  p_observed_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_lock public.admin_user_mutation_locks%rowtype;
  v_target_email_normalized text;
  v_preserve_newer_lease boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  if p_expected_credential_version <= 0
    or p_observed_credential_version <= 0
    or p_observed_credential_version >= p_expected_credential_version
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into strict v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  perform pg_advisory_xact_lock(
    hashtextextended(v_target_email_normalized, 0)
  );

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  select *
  into v_lock
  from public.admin_user_mutation_locks
  where target_email_normalized = v_operation.target_email_normalized
  for update;

  if found
    and v_lock.operation_id = p_operation_id
    and v_lock.fence_version = p_fence_version
  then
    update public.admin_user_mutation_locks
    set state = 'quarantined',
        quarantine_code = 'credential_version_mismatch',
        quarantine_reason = 'Credential versions do not match.',
        updated_at = v_now
    where target_email_normalized = v_operation.target_email_normalized
      and operation_id = p_operation_id;
  elsif found
    and v_lock.operation_id = p_operation_id
    and v_lock.fence_version > p_fence_version
  then
    v_preserve_newer_lease := true;

    update public.admin_user_mutation_locks
    set state = 'quarantined',
        quarantine_code = 'credential_version_mismatch',
        quarantine_reason = 'Credential versions do not match.',
        updated_at = v_now
    where target_email_normalized = v_operation.target_email_normalized
      and operation_id = p_operation_id
      and fence_version = v_lock.fence_version;
  elsif found
    and v_lock.operation_id <> p_operation_id
    and v_lock.fence_version > p_fence_version
  then
    null;
  elsif found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  update public.admin_user_operations
  set status = 'needs_review',
      stage = 'late_fence',
      safe_error_code = 'credential_version_mismatch',
      safe_error_message = 'Credential versions do not match.',
      lease_token_hash = case
        when v_preserve_newer_lease then lease_token_hash
        else null
      end,
      lease_expires_at = case
        when v_preserve_newer_lease then lease_expires_at
        else null
      end,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.record_admin_user_late_fence(
  p_operation_id uuid,
  p_fence_version integer,
  p_expected_credential_version integer,
  p_observed_credential_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.record_admin_user_late_fence_impl(
    p_operation_id,
    p_fence_version,
    p_expected_credential_version,
    p_observed_credential_version
  );
end;
$$;

create or replace function private.create_admin_user_profile_for_operation_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_user_id uuid,
  p_email_normalized text
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
  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.action <> 'create_user'
    or v_operation.target_user_id <> p_user_id
    or v_operation.target_email_normalized <> p_email_normalized
    or v_operation.status <> 'provider_outcome'
    or v_operation.safe_result ->> 'providerStep' <> 'auth_create'
    or v_operation.safe_result ->> 'outcome' <> 'succeeded'
    or v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  perform 1
  from public.admin_user_mutation_locks
  where target_email_normalized = p_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and state = 'leased'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  begin
    insert into public.admin_users (
      user_id,
      email,
      role,
      is_active,
      must_change_password,
      credential_version
    )
    values (
      p_user_id,
      p_email_normalized,
      'admin',
      true,
      true,
      1
    )
    returning * into strict v_profile;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'profile_write_failed';
  end;

  update public.admin_user_operations
  set status = 'leased',
      stage = 'profile_created',
      updated_at = v_now
  where operation_id = p_operation_id;

  return to_jsonb(v_profile);
end;
$$;

create or replace function public.create_admin_user_profile_for_operation(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_user_id uuid,
  p_email_normalized text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.create_admin_user_profile_for_operation_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_user_id,
    p_email_normalized
  );
end;
$$;

create or replace function private.advance_admin_user_profile_for_operation_impl(
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
  v_operation public.admin_user_operations%rowtype;
  v_profile public.admin_users%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_expected_credential_version <= 0
    or p_next_credential_version <> p_expected_credential_version + 1
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.action not in (
      'reissue_temporary_password',
      'suspend_user',
      'reactivate_user'
    )
    or v_operation.target_email_normalized <> p_email_normalized
    or (
      v_operation.target_user_id is not null
      and v_operation.target_user_id <> p_user_id
    )
    or v_operation.status <> 'leased'
    or v_operation.stage <> 'claimed'
    or v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  if (
      v_operation.action = 'reissue_temporary_password'
      and not (
        p_expected_is_active
        and p_next_is_active
        and p_next_must_change_password
      )
    )
    or (
      v_operation.action = 'suspend_user'
      and not (p_expected_is_active and not p_next_is_active)
    )
    or (
      v_operation.action = 'reactivate_user'
      and not (
        not p_expected_is_active
        and not p_next_is_active
        and p_next_must_change_password
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  perform 1
  from public.admin_user_mutation_locks
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
      safe_result = jsonb_build_object(
        'userId', p_user_id,
        'credentialVersion', p_next_credential_version,
        'profileState', case
          when p_next_is_active then 'active_forced'
          else 'inactive'
        end
      ),
      updated_at = v_now
  where operation_id = p_operation_id;

  return to_jsonb(v_profile);
end;
$$;

create or replace function public.advance_admin_user_profile_for_operation(
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
begin
  return private.advance_admin_user_profile_for_operation_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_user_id,
    p_email_normalized,
    p_expected_is_active,
    p_expected_must_change_password,
    p_expected_credential_version,
    p_next_is_active,
    p_next_must_change_password,
    p_next_credential_version
  );
end;
$$;

create or replace function private.activate_admin_user_profile_for_operation_impl(
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
  v_profile public.admin_users%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_credential_version <= 0 then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.action <> 'reactivate_user'
    or v_operation.target_user_id <> p_user_id
    or v_operation.target_email_normalized <> p_email_normalized
    or v_operation.status <> 'provider_outcome'
    or v_operation.safe_result ->> 'providerStep' <> 'global_signout'
    or v_operation.safe_result ->> 'outcome' <> 'succeeded'
    or (v_operation.safe_result ->> 'credentialVersion')::integer
      <> p_credential_version
    or v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  perform 1
  from public.admin_user_mutation_locks
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
  set is_active = true
  where user_id = p_user_id
    and email = p_email_normalized
    and is_active = false
    and must_change_password = true
    and credential_version = p_credential_version
  returning * into v_profile;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;

  update public.admin_user_operations
  set status = 'leased',
      stage = 'profile_activated',
      updated_at = v_now
  where operation_id = p_operation_id;

  return to_jsonb(v_profile);
end;
$$;

create or replace function public.activate_admin_user_profile_for_operation(
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
begin
  return private.activate_admin_user_profile_for_operation_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_user_id,
    p_email_normalized,
    p_credential_version
  );
end;
$$;

revoke all on function private.resume_admin_user_operation_impl(uuid, uuid, text, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function private.commit_admin_user_provider_stage_impl(uuid, integer, text, text, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.mark_admin_user_operation_needs_review_impl(uuid, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function private.record_admin_user_late_fence_impl(uuid, integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function private.create_admin_user_profile_for_operation_impl(uuid, integer, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.advance_admin_user_profile_for_operation_impl(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) from public, anon, authenticated, service_role;
revoke all on function private.activate_admin_user_profile_for_operation_impl(uuid, integer, text, uuid, text, integer) from public, anon, authenticated, service_role;

revoke all on function public.resume_admin_user_operation(uuid, uuid, text, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.commit_admin_user_provider_stage(uuid, integer, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mark_admin_user_operation_needs_review(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.record_admin_user_late_fence(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.create_admin_user_profile_for_operation(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.advance_admin_user_profile_for_operation(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) from public, anon, authenticated;
revoke all on function public.activate_admin_user_profile_for_operation(uuid, integer, text, uuid, text, integer) from public, anon, authenticated;

grant execute on function public.resume_admin_user_operation(uuid, uuid, text, uuid, text, text, text, integer) to service_role;
grant execute on function public.commit_admin_user_provider_stage(uuid, integer, text, text, text, uuid, jsonb) to service_role;
grant execute on function public.mark_admin_user_operation_needs_review(uuid, integer, text, text) to service_role;
grant execute on function public.record_admin_user_late_fence(uuid, integer, integer, integer) to service_role;
grant execute on function public.create_admin_user_profile_for_operation(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.advance_admin_user_profile_for_operation(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) to service_role;
grant execute on function public.activate_admin_user_profile_for_operation(uuid, integer, text, uuid, text, integer) to service_role;

notify pgrst, 'reload schema';
