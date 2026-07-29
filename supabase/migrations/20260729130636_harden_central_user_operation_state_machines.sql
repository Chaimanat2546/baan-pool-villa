create table public.admin_user_mutation_fences (
  target_email_normalized text primary key
    check (
      target_email_normalized = lower(btrim(target_email_normalized))
      and target_email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  last_fence_version integer not null check (last_fence_version > 0),
  is_quarantined boolean not null default false,
  quarantine_code text,
  quarantine_reason text,
  updated_at timestamptz not null default now()
);

insert into public.admin_user_mutation_fences (
  target_email_normalized,
  last_fence_version
)
select target_email_normalized, greatest(max(fence_version), 1)
from public.admin_user_operations
where target_email_normalized is not null
group by target_email_normalized
on conflict (target_email_normalized) do update
set last_fence_version = greatest(
      public.admin_user_mutation_fences.last_fence_version,
      excluded.last_fence_version
    ),
    updated_at = now();

create table public.admin_user_provider_events (
  operation_id uuid not null
    references public.admin_user_operations(operation_id),
  provider_step text not null check (
    provider_step in (
      'auth_create',
      'auth_delete',
      'auth_update',
      'password_verify',
      'global_signout'
    )
  ),
  step_ordinal integer not null check (step_ordinal between 1 and 3),
  outcome text check (outcome in ('succeeded', 'rejected')),
  target_user_id uuid,
  credential_version integer check (
    credential_version is null or credential_version > 0
  ),
  provider_error_code text,
  intent_at timestamptz not null default now(),
  outcome_at timestamptz,
  primary key (operation_id, provider_step),
  unique (operation_id, step_ordinal),
  constraint admin_user_provider_events_outcome_shape check (
    (
      outcome is null
      and target_user_id is null
      and credential_version is null
      and provider_error_code is null
      and outcome_at is null
    )
    or (
      outcome is not null
      and credential_version is not null
      and outcome_at is not null
      and (
        (outcome = 'succeeded' and provider_error_code is null)
        or (outcome = 'rejected' and provider_error_code is not null)
      )
    )
  )
);

alter table public.admin_user_mutation_fences enable row level security;
alter table public.admin_user_mutation_fences force row level security;
alter table public.admin_user_provider_events enable row level security;
alter table public.admin_user_provider_events force row level security;

revoke all on table public.admin_user_mutation_fences,
  public.admin_user_provider_events
from public, anon, authenticated, service_role;

create or replace function private.resume_admin_user_operation_v2_impl(
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
  v_result jsonb;
  v_operation public.admin_user_operations%rowtype;
  v_next_fence integer;
begin
  if p_operation_id is null
    or p_actor_uid is null
    or p_action is null
    or p_target_email_normalized is null
    or p_request_hash is null
    or p_lease_token_hash is null
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_target_email_normalized, 0)
  );

  insert into public.admin_user_mutation_fences (
    target_email_normalized,
    last_fence_version
  )
  values (p_target_email_normalized, 1)
  on conflict (target_email_normalized) do nothing;

  perform 1
  from public.admin_user_mutation_fences
  where target_email_normalized = p_target_email_normalized
    and is_quarantined = true
  for update;

  if found then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  v_result := private.resume_admin_user_operation_impl(
    p_operation_id,
    p_actor_uid,
    p_action,
    p_target_user_id,
    p_target_email_normalized,
    p_request_hash,
    p_lease_token_hash,
    p_lease_seconds
  );

  if (v_result ->> 'lease_token_accepted')::boolean then
    select *
    into strict v_operation
    from public.admin_user_operations
    where operation_id = p_operation_id
    for update;

    update public.admin_user_mutation_fences
    set last_fence_version = greatest(
          last_fence_version,
          v_operation.fence_version
        ) + 1,
        updated_at = clock_timestamp()
    where target_email_normalized = p_target_email_normalized
    returning last_fence_version into strict v_next_fence;

    update public.admin_user_mutation_locks
    set fence_version = v_next_fence
    where target_email_normalized = p_target_email_normalized
      and operation_id = p_operation_id;

    update public.admin_user_operations
    set fence_version = v_next_fence
    where operation_id = p_operation_id
    returning * into strict v_operation;

    v_result := jsonb_build_object(
      'operation', private.admin_user_operation_record(v_operation),
      'disposition', v_result ->> 'disposition',
      'lease_token_accepted', true
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.resume_admin_user_operation_v2(
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
  return private.resume_admin_user_operation_v2_impl(
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
    v_step_ordinal := 1;
  elsif v_operation.action = 'create_user'
    and p_provider_step = 'auth_delete'
  then
    v_expected_stage := 'compensation_ready';
    v_step_ordinal := 2;
  elsif v_operation.action in (
      'reissue_temporary_password',
      'suspend_user',
      'reactivate_user'
    )
    and p_provider_step = 'auth_update'
  then
    v_expected_stage := 'profile_advanced';
    v_step_ordinal := 1;
  elsif v_operation.action in (
      'reissue_temporary_password',
      'reactivate_user'
    )
    and p_provider_step = 'password_verify'
  then
    v_expected_stage := 'auth_update_succeeded';
    v_step_ordinal := 2;
  elsif v_operation.action in (
      'reissue_temporary_password',
      'reactivate_user'
    )
    and p_provider_step = 'global_signout'
  then
    v_expected_stage := 'password_verify_succeeded';
    v_step_ordinal := 3;
  else
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_operation.stage is distinct from v_expected_stage
    or v_operation.status is distinct from 'leased'
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

create or replace function public.commit_admin_user_provider_intent_v2(
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
begin
  return private.commit_admin_user_provider_intent_v2_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_provider_step
  );
end;
$$;

create or replace function private.commit_admin_user_provider_outcome_v2_impl(
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
declare
  v_operation public.admin_user_operations%rowtype;
  v_event public.admin_user_provider_events%rowtype;
  v_target_email_normalized text;
  v_expected_version integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_outcome not in ('succeeded', 'rejected')
    or (
      p_target_user_id is null
      and not (
        p_provider_step = 'auth_create'
        and p_outcome = 'rejected'
      )
    )
    or p_credential_version is null
    or p_credential_version <= 0
    or (
      p_outcome is distinct from 'succeeded'
      and p_provider_error_code is null
    )
    or (
      p_outcome = 'succeeded'
      and p_provider_error_code is not null
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

  select *
  into strict v_event
  from public.admin_user_provider_events
  where operation_id = p_operation_id
    and provider_step = p_provider_step
  for update;

  if p_provider_step is distinct from v_event.provider_step
    or v_event.outcome is not null
    or v_operation.status is distinct from 'provider_intent'
    or v_operation.stage is distinct from p_provider_step || '_intent'
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if p_provider_step = 'auth_create' then
    v_expected_version := 1;
    if v_operation.action is distinct from 'create_user'
      or v_operation.target_user_id is not null
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  else
    if v_operation.target_user_id is distinct from p_target_user_id then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
    begin
      v_expected_version :=
        (v_operation.safe_result ->> 'credentialVersion')::integer;
    exception
      when others then
        raise exception using errcode = 'P0001', message = 'operation_conflict';
    end;
  end if;

  if v_expected_version is null
    or v_expected_version <= 0
    or v_expected_version is distinct from p_credential_version
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  update public.admin_user_provider_events
  set outcome = p_outcome,
      target_user_id = p_target_user_id,
      credential_version = p_credential_version,
      provider_error_code = p_provider_error_code,
      outcome_at = v_now
  where operation_id = p_operation_id
    and provider_step = p_provider_step;

  if p_outcome = 'rejected' then
    update public.admin_user_mutation_locks
    set state = 'quarantined',
        quarantine_code = 'provider_failure',
        quarantine_reason = 'Unable to complete request.',
        updated_at = v_now
    where target_email_normalized = v_target_email_normalized
      and operation_id = p_operation_id
      and fence_version = p_fence_version
      and lease_token_hash = p_lease_token_hash;

    if not found then
      raise exception using errcode = 'P0001', message = 'lease_lost';
    end if;

    update public.admin_user_operations
    set target_user_id = coalesce(target_user_id, p_target_user_id),
        status = 'needs_review',
        stage = p_provider_step || '_rejected',
        safe_result = jsonb_build_object(
          'providerStep', p_provider_step,
          'outcome', p_outcome,
          'userId', p_target_user_id,
          'credentialVersion', p_credential_version,
          'errorCode', p_provider_error_code
        ),
        safe_error_code = 'provider_failure',
        safe_error_message = 'Unable to complete request.',
        lease_token_hash = null,
        lease_expires_at = null,
        provider_outcome_at = v_now,
        updated_at = v_now
    where operation_id = p_operation_id
    returning * into strict v_operation;
  else
    update public.admin_user_operations
    set target_user_id = coalesce(target_user_id, p_target_user_id),
        status = 'provider_outcome',
        stage = p_provider_step || '_succeeded',
        safe_result = jsonb_build_object(
          'providerStep', p_provider_step,
          'outcome', p_outcome,
          'userId', p_target_user_id,
          'credentialVersion', p_credential_version
        ),
        provider_outcome_at = v_now,
        updated_at = v_now
    where operation_id = p_operation_id
    returning * into strict v_operation;
  end if;

  return private.admin_user_operation_record(v_operation);
end;
$$;

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

create or replace function private.create_admin_user_profile_for_operation_v2_impl(
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
  if p_user_id is null or p_email_normalized is null then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  if v_operation.action is distinct from 'create_user'
    or v_operation.stage is distinct from 'auth_create_succeeded'
    or v_operation.status is distinct from 'provider_outcome'
    or v_operation.target_user_id is distinct from p_user_id
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
    or v_operation.safe_result is distinct from jsonb_build_object(
      'providerStep', 'auth_create',
      'outcome', 'succeeded',
      'userId', p_user_id,
      'credentialVersion', 1
    )
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  perform 1 from public.admin_user_provider_events
  where operation_id = p_operation_id
    and provider_step = 'auth_create'
    and outcome = 'succeeded'
    and target_user_id = p_user_id
    and credential_version = 1;
  if not found then
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
  begin
    insert into public.admin_users (
      user_id, email, role, is_active,
      must_change_password, credential_version
    )
    values (p_user_id, p_email_normalized, 'admin', true, true, 1)
    returning * into strict v_profile;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'profile_write_failed';
  end;
  update public.admin_user_operations
  set status = 'leased', stage = 'profile_created', updated_at = v_now
  where operation_id = p_operation_id;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.create_admin_user_profile_for_operation_v2(
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
  return private.create_admin_user_profile_for_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_user_id, p_email_normalized
  );
end;
$$;

create or replace function private.prepare_admin_user_create_compensation_v2_impl(
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
  v_now timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  if v_operation.action is distinct from 'create_user'
    or v_operation.stage is distinct from 'auth_create_succeeded'
    or v_operation.target_user_id is distinct from p_user_id
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
    or not exists (
      select 1
      from public.admin_user_provider_events
      where operation_id = p_operation_id
        and provider_step = 'auth_create'
        and outcome = 'succeeded'
        and target_user_id = p_user_id
        and credential_version = 1
    )
    or not exists (
      select 1
      from public.admin_user_mutation_locks
      where target_email_normalized = p_email_normalized
        and operation_id = p_operation_id
        and fence_version = p_fence_version
        and lease_token_hash = p_lease_token_hash
        and state = 'leased'
    )
    or not (
      not exists (
        select 1
        from public.admin_users
        where user_id = p_user_id
          or email = p_email_normalized
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  update public.admin_user_operations
  set status = 'leased', stage = 'compensation_ready', updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;
  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.prepare_admin_user_create_compensation_v2(
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
  return private.prepare_admin_user_create_compensation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_user_id, p_email_normalized
  );
end;
$$;

create or replace function private.advance_admin_user_profile_for_operation_v2_impl(
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
  if p_user_id is null
    or p_email_normalized is null
    or p_expected_credential_version is null
    or p_expected_credential_version <= 0
    or p_next_credential_version is distinct from
      p_expected_credential_version + 1
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
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
    )
    or (
      v_operation.action = 'suspend_user'
      and (
        p_expected_is_active is distinct from true
        or p_next_is_active is distinct from false
      )
    )
    or (
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
      safe_result = jsonb_build_object(
        'userId', p_user_id,
        'credentialVersion', p_next_credential_version,
        'profileIsActive', p_next_is_active,
        'profileMustChangePassword', p_next_must_change_password
      ),
      updated_at = v_now
  where operation_id = p_operation_id;
  return to_jsonb(v_profile);
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
begin
  return private.advance_admin_user_profile_for_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_user_id, p_email_normalized, p_expected_is_active,
    p_expected_must_change_password, p_expected_credential_version,
    p_next_is_active, p_next_must_change_password,
    p_next_credential_version
  );
end;
$$;

create or replace function private.activate_admin_user_profile_for_operation_v2_impl(
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
  if p_user_id is null
    or p_email_normalized is null
    or p_credential_version is null
    or p_credential_version <= 0
  then
    raise exception using errcode = 'P0001', message = 'profile_state_conflict';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_email_normalized, 0));
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  if v_operation.action is distinct from 'reactivate_user'
    or v_operation.stage is distinct from 'global_signout_succeeded'
    or v_operation.status is distinct from 'provider_outcome'
    or v_operation.target_user_id is distinct from p_user_id
    or v_operation.target_email_normalized is distinct from p_email_normalized
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
    or v_operation.safe_result is distinct from jsonb_build_object(
      'providerStep', 'global_signout',
      'outcome', 'succeeded',
      'userId', p_user_id,
      'credentialVersion', p_credential_version
    )
    or (
      select count(*)
      from public.admin_user_provider_events
      where operation_id = p_operation_id
        and outcome = 'succeeded'
        and (
          (provider_step = 'auth_update' and step_ordinal = 1)
          or (provider_step = 'password_verify' and step_ordinal = 2)
          or (provider_step = 'global_signout' and step_ordinal = 3)
        )
    ) is distinct from 3::bigint
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
  set status = 'leased', stage = 'profile_activated', updated_at = v_now
  where operation_id = p_operation_id;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.activate_admin_user_profile_for_operation_v2(
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
  return private.activate_admin_user_profile_for_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_user_id, p_email_normalized, p_credential_version
  );
end;
$$;

create or replace function private.complete_admin_user_operation_v2_impl(
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
  v_target_email_normalized text;
  v_safe_user jsonb;
  v_safe_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select target_email_normalized
  into strict v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;
  perform pg_advisory_xact_lock(
    hashtextextended(v_target_email_normalized, 0)
  );
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  if v_operation.status = 'provider_intent'
    or v_operation.fence_version is distinct from p_fence_version
    or v_operation.lease_token_hash is distinct from p_lease_token_hash
    or v_operation.lease_expires_at is null
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;
  if p_terminal_kind = 'success' then
    if (
        v_operation.action = 'create_user'
        and v_operation.stage is distinct from 'profile_created'
      )
      or (
        v_operation.action = 'suspend_user'
        and v_operation.stage is distinct from 'auth_update_succeeded'
      )
      or (
        v_operation.action = 'reissue_temporary_password'
        and v_operation.stage is distinct from 'global_signout_succeeded'
      )
      or (
        v_operation.action = 'reactivate_user'
        and v_operation.stage is distinct from 'profile_activated'
      )
      or p_user_id is null
      or p_email_normalized is null
      or p_user_status not in (
        'active', 'password_change_required', 'suspended', 'abnormal'
      )
      or p_credential_version is null
      or p_credential_version <= 0
      or p_auth_credential_version is distinct from p_credential_version
      or p_error_code is not null
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  elsif p_terminal_kind = 'duplicate' then
    if v_operation.action is distinct from 'create_user'
      or v_operation.stage is distinct from 'claimed'
      or p_error_code is distinct from 'user_exists'
      or p_user_id is null
      or p_email_normalized is null
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  elsif p_terminal_kind = 'compensated' then
    if v_operation.action is distinct from 'create_user'
      or v_operation.stage is distinct from 'auth_delete_succeeded'
      or p_error_code is distinct from 'create_compensated'
      or p_user_id is not null
      or p_email_normalized is not null
      or p_user_status is not null
      or p_created_at is not null
      or p_last_sign_in_at is not null
      or p_credential_version is not null
      or p_auth_credential_version is not null
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  else
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;
  if p_terminal_kind in ('success', 'duplicate') then
    v_safe_user := jsonb_build_object(
      'userId', p_user_id,
      'email', p_email_normalized,
      'status', p_user_status,
      'createdAt', p_created_at,
      'lastSignInAt', p_last_sign_in_at,
      'credentialVersion', p_credential_version,
      'authCredentialVersion', p_auth_credential_version
    );
  end if;
  v_safe_result := jsonb_build_object(
    'outcome', case
      when p_terminal_kind = 'success' then 'success'
      else 'failed'
    end
  );
  if v_safe_user is not null then
    v_safe_result := v_safe_result || jsonb_build_object('user', v_safe_user);
  end if;
  if p_error_code is not null then
    v_safe_result := v_safe_result ||
      jsonb_build_object('errorCode', p_error_code);
  end if;
  perform 1 from public.admin_user_mutation_locks
  where target_email_normalized = v_target_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and state = 'leased'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;
  update public.admin_user_operations
  set status = 'completed',
      stage = 'completed',
      safe_result = v_safe_result,
      safe_error_code = case
        when p_error_code is not null then p_error_code
        else null
      end,
      safe_error_message = case p_error_code
        when 'user_exists' then 'An admin user already exists for this email.'
        when 'create_compensated' then 'User creation was rolled back safely.'
        else null
      end,
      lease_token_hash = null,
      lease_expires_at = null,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;
  delete from public.admin_user_mutation_locks
  where target_email_normalized = v_target_email_normalized
    and operation_id = p_operation_id
    and fence_version = p_fence_version;
  return private.admin_user_operation_record(v_operation);
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
  return private.complete_admin_user_operation_v2_impl(
    p_operation_id, p_fence_version, p_lease_token_hash,
    p_terminal_kind, p_user_id, p_email_normalized,
    p_user_status, p_created_at, p_last_sign_in_at,
    p_credential_version, p_auth_credential_version, p_error_code
  );
end;
$$;

create or replace function private.record_admin_user_late_fence_v2_impl(
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
  v_preserve_current_lease boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  if p_expected_credential_version is null
    or p_observed_credential_version is null
    or p_expected_credential_version <= 0
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
  select * into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;
  insert into public.admin_user_mutation_fences (
    target_email_normalized,
    last_fence_version,
    is_quarantined,
    quarantine_code,
    quarantine_reason
  )
  values (
    v_target_email_normalized,
    greatest(p_fence_version, 1),
    true,
    'credential_version_mismatch',
    'Credential versions do not match.'
  )
  on conflict (target_email_normalized) do update
  set last_fence_version = greatest(
        public.admin_user_mutation_fences.last_fence_version,
        excluded.last_fence_version
      ),
      is_quarantined = true,
      quarantine_code = excluded.quarantine_code,
      quarantine_reason = excluded.quarantine_reason,
      updated_at = v_now;
  select * into v_lock
  from public.admin_user_mutation_locks
  where target_email_normalized = v_target_email_normalized
  for update;
  if found then
    v_preserve_current_lease :=
      v_lock.operation_id = p_operation_id
      and v_lock.fence_version > p_fence_version;
    update public.admin_user_mutation_locks
    set state = 'quarantined',
        quarantine_code = 'credential_version_mismatch',
        quarantine_reason = 'Credential versions do not match.',
        updated_at = v_now
    where target_email_normalized = v_target_email_normalized;
  end if;
  update public.admin_user_operations
  set status = 'needs_review',
      stage = 'late_fence',
      safe_error_code = 'credential_version_mismatch',
      safe_error_message = 'Credential versions do not match.',
      lease_token_hash = case
        when v_preserve_current_lease then lease_token_hash
        else null
      end,
      lease_expires_at = case
        when v_preserve_current_lease then lease_expires_at
        else null
      end,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;
  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.record_admin_user_late_fence_v2(
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
  return private.record_admin_user_late_fence_v2_impl(
    p_operation_id, p_fence_version,
    p_expected_credential_version, p_observed_credential_version
  );
end;
$$;

revoke execute on function public.claim_admin_user_operation(uuid, text, uuid, text, uuid, text, text, text, integer) from service_role;
revoke execute on function public.commit_admin_user_operation_stage(uuid, integer, text, text, uuid, jsonb) from service_role;
revoke execute on function public.commit_admin_user_provider_stage(uuid, integer, text, text, text, uuid, jsonb) from service_role;
revoke execute on function public.complete_admin_user_operation(uuid, integer, text, jsonb) from service_role;

revoke all on function private.resume_admin_user_operation_v2_impl(uuid, uuid, text, uuid, text, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function private.commit_admin_user_provider_intent_v2_impl(uuid, integer, text, text) from public, anon, authenticated, service_role;
revoke all on function private.commit_admin_user_provider_outcome_v2_impl(uuid, integer, text, text, text, uuid, integer, text) from public, anon, authenticated, service_role;
revoke all on function private.create_admin_user_profile_for_operation_v2_impl(uuid, integer, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.prepare_admin_user_create_compensation_v2_impl(uuid, integer, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.advance_admin_user_profile_for_operation_v2_impl(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) from public, anon, authenticated, service_role;
revoke all on function private.activate_admin_user_profile_for_operation_v2_impl(uuid, integer, text, uuid, text, integer) from public, anon, authenticated, service_role;
revoke all on function private.complete_admin_user_operation_v2_impl(uuid, integer, text, text, uuid, text, text, timestamptz, timestamptz, integer, integer, text) from public, anon, authenticated, service_role;
revoke all on function private.record_admin_user_late_fence_v2_impl(uuid, integer, integer, integer) from public, anon, authenticated, service_role;

revoke all on function public.resume_admin_user_operation_v2(uuid, uuid, text, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.commit_admin_user_provider_intent_v2(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.commit_admin_user_provider_outcome_v2(uuid, integer, text, text, text, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.create_admin_user_profile_for_operation_v2(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.prepare_admin_user_create_compensation_v2(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.advance_admin_user_profile_for_operation_v2(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) from public, anon, authenticated;
revoke all on function public.activate_admin_user_profile_for_operation_v2(uuid, integer, text, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.complete_admin_user_operation_v2(uuid, integer, text, text, uuid, text, text, timestamptz, timestamptz, integer, integer, text) from public, anon, authenticated;
revoke all on function public.record_admin_user_late_fence_v2(uuid, integer, integer, integer) from public, anon, authenticated;

grant execute on function public.resume_admin_user_operation_v2(uuid, uuid, text, uuid, text, text, text, integer) to service_role;
grant execute on function public.commit_admin_user_provider_intent_v2(uuid, integer, text, text) to service_role;
grant execute on function public.commit_admin_user_provider_outcome_v2(uuid, integer, text, text, text, uuid, integer, text) to service_role;
grant execute on function public.create_admin_user_profile_for_operation_v2(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.prepare_admin_user_create_compensation_v2(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.advance_admin_user_profile_for_operation_v2(uuid, integer, text, uuid, text, boolean, boolean, integer, boolean, boolean, integer) to service_role;
grant execute on function public.activate_admin_user_profile_for_operation_v2(uuid, integer, text, uuid, text, integer) to service_role;
grant execute on function public.complete_admin_user_operation_v2(uuid, integer, text, text, uuid, text, text, timestamptz, timestamptz, integer, integer, text) to service_role;
grant execute on function public.record_admin_user_late_fence_v2(uuid, integer, integer, integer) to service_role;

notify pgrst, 'reload schema';
