create or replace function private.commit_admin_user_provider_intent_v2_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_provider_step text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_target_email_normalized text;
  v_expected_stage text;
  v_expected_status text;
  v_step_ordinal integer;
  v_now timestamptz := clock_timestamp();
begin
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

  if v_operation.action = 'create_user'
    and p_provider_step = 'auth_create'
  then
    v_expected_stage := 'claimed';
    v_expected_status := 'leased';
    v_step_ordinal := 1;
  elsif v_operation.action = 'create_user'
    and p_provider_step = 'auth_delete'
  then
    v_expected_stage := 'compensation_ready';
    v_expected_status := 'leased';
    v_step_ordinal := 2;
  elsif v_operation.action in (
      'reissue_temporary_password',
      'suspend_user',
      'reactivate_user'
    )
    and p_provider_step = 'auth_update'
  then
    v_expected_stage := 'profile_advanced';
    v_expected_status := 'leased';
    v_step_ordinal := 1;
  elsif v_operation.action in (
      'reissue_temporary_password',
      'reactivate_user'
    )
    and p_provider_step = 'password_verify'
  then
    v_expected_stage := 'auth_update_succeeded';
    v_expected_status := 'provider_outcome';
    v_step_ordinal := 2;
  elsif v_operation.action in (
      'reissue_temporary_password',
      'reactivate_user'
    )
    and p_provider_step = 'global_signout'
  then
    v_expected_stage := 'password_verify_succeeded';
    v_expected_status := 'provider_outcome';
    v_step_ordinal := 3;
  else
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_operation.stage is distinct from v_expected_stage
    or v_operation.status is distinct from v_expected_status
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform 1
  from public.admin_user_mutation_locks
  where target_email_normalized = v_target_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and state = 'leased'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  insert into public.admin_user_provider_events (
    operation_id,
    provider_step,
    step_ordinal
  )
  values (p_operation_id, p_provider_step, v_step_ordinal);

  update public.admin_user_operations
  set status = 'provider_intent',
      stage = p_provider_step || '_intent',
      provider_intent_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  return private.admin_user_operation_record(v_operation);
end;
$$;

revoke all on function private.commit_admin_user_provider_intent_v2_impl(
  uuid,
  integer,
  text,
  text
) from public, anon, authenticated, service_role;

do $$
declare
  v_candidate record;
  v_operation public.admin_user_operations%rowtype;
  v_lock public.admin_user_mutation_locks%rowtype;
  v_fence public.admin_user_mutation_fences%rowtype;
  v_event public.admin_user_provider_events%rowtype;
  v_profile public.admin_users%rowtype;
  v_auth_user auth.users%rowtype;
  v_credential_version integer;
  v_auth_managed boolean;
  v_auth_credential_version integer;
  v_now timestamptz := clock_timestamp();
begin
  for v_candidate in
    select operation_id, target_email_normalized
    from public.admin_user_operations
    where action = 'reactivate_user'
      and status = 'provider_outcome'
      and stage = 'auth_update_succeeded'
      and lease_expires_at is not null
      and lease_expires_at <= v_now
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_candidate.target_email_normalized, 0)
    );

    select *
    into v_operation
    from public.admin_user_operations
    where operation_id = v_candidate.operation_id
    for update;

    if not found
      or v_operation.action is distinct from 'reactivate_user'
      or v_operation.status is distinct from 'provider_outcome'
      or v_operation.stage is distinct from 'auth_update_succeeded'
      or v_operation.target_user_id is null
      or v_operation.target_email_normalized is null
      or v_operation.lease_token_hash is null
      or v_operation.lease_expires_at is null
      or v_operation.lease_expires_at > v_now
      or v_operation.safe_error_code is not null
    then
      continue;
    end if;

    begin
      v_credential_version :=
        (v_operation.safe_result ->> 'credentialVersion')::integer;
    exception
      when others then
        continue;
    end;

    if v_credential_version <= 0
      or v_operation.safe_result ->> 'providerStep' is distinct from
        'auth_update'
      or v_operation.safe_result ->> 'outcome' is distinct from 'succeeded'
      or v_operation.safe_result ->> 'userId' is distinct from
        v_operation.target_user_id::text
    then
      continue;
    end if;

    select *
    into v_lock
    from public.admin_user_mutation_locks
    where target_email_normalized = v_operation.target_email_normalized
    for update;

    if not found
      or v_lock.state is distinct from 'leased'
      or v_lock.owner_kind is distinct from 'central_operation'
      or v_lock.operation_id is distinct from v_operation.operation_id
      or v_lock.fence_version is distinct from v_operation.fence_version
      or v_lock.lease_token_hash is distinct from
        v_operation.lease_token_hash
      or v_lock.lease_expires_at > v_now
    then
      continue;
    end if;

    select *
    into v_fence
    from public.admin_user_mutation_fences
    where target_email_normalized = v_operation.target_email_normalized
    for update;

    if not found
      or v_fence.is_quarantined
      or v_fence.last_fence_version is distinct from
        v_operation.fence_version
    then
      continue;
    end if;

    select *
    into v_event
    from public.admin_user_provider_events
    where operation_id = v_operation.operation_id
      and provider_step = 'auth_update'
    for update;

    if not found
      or v_event.provider_step is distinct from 'auth_update'
      or v_event.step_ordinal is distinct from 1
      or v_event.outcome is distinct from 'succeeded'
      or v_event.target_user_id is distinct from v_operation.target_user_id
      or v_event.credential_version is distinct from v_credential_version
      or v_event.provider_error_code is not null
      or v_event.outcome_at is null
    then
      continue;
    end if;

    select *
    into v_profile
    from public.admin_users
    where user_id = v_operation.target_user_id
      and email = v_operation.target_email_normalized
    for update;

    if not found
      or v_profile.is_active
      or v_profile.must_change_password is distinct from true
      or v_profile.credential_version is distinct from v_credential_version
    then
      continue;
    end if;

    select *
    into v_auth_user
    from auth.users
    where id = v_operation.target_user_id
      and lower(btrim(email)) = v_operation.target_email_normalized
    for update;

    if not found then
      continue;
    end if;

    begin
      v_auth_managed :=
        (v_auth_user.raw_app_meta_data ->> 'bpv_admin_managed')::boolean;
      v_auth_credential_version :=
        (v_auth_user.raw_app_meta_data ->> 'credential_version')::integer;
    exception
      when others then
        continue;
    end;

    if v_auth_managed is distinct from true
      or v_auth_credential_version is distinct from v_credential_version
      or v_auth_user.banned_until is null
      or v_auth_user.banned_until <= v_now
    then
      continue;
    end if;

    delete from public.admin_user_mutation_locks
    where target_email_normalized = v_operation.target_email_normalized
      and operation_id = v_operation.operation_id
      and fence_version = v_operation.fence_version
      and lease_token_hash = v_operation.lease_token_hash
      and state = 'leased'
      and lease_expires_at <= v_now;

    if not found then
      continue;
    end if;

    update public.admin_user_operations
    set status = 'needs_review',
        stage = 'needs_review',
        safe_error_code = 'profile_state_conflict',
        safe_error_message = 'Admin profile state changed.',
        lease_token_hash = null,
        lease_expires_at = null,
        updated_at = v_now
    where operation_id = v_operation.operation_id
      and status = 'provider_outcome'
      and stage = 'auth_update_succeeded'
      and fence_version = v_operation.fence_version
      and lease_token_hash = v_operation.lease_token_hash;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'operation_conflict';
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
