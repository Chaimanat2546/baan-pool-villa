do $$
begin
  if exists (
    select 1
    from public.admin_users
    where email is null
      or btrim(email) = ''
      or lower(btrim(email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception 'invalid admin_users email';
  end if;

  if exists (
    select lower(btrim(email))
    from public.admin_users
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'duplicate admin_users email';
  end if;
end;
$$;

update public.admin_users
set email = lower(btrim(email));

alter table public.admin_users
  add column must_change_password boolean not null default false,
  add column credential_version integer not null default 1 check (credential_version > 0);

create unique index admin_users_email_normalized_key
  on public.admin_users (lower(btrim(email)));

create or replace function private.admin_user_safe_json(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_type text;
  v_key text;
  v_normalized_key text;
  v_child jsonb;
begin
  if p_value is null then
    return true;
  end if;

  v_type := jsonb_typeof(p_value);
  if v_type = 'object' then
    for v_key, v_child in
      select key, value
      from jsonb_each(p_value)
    loop
      v_normalized_key := regexp_replace(lower(v_key), '[^a-z0-9]', '', 'g');
      if v_normalized_key ~ '(password|token|secret|authorization|hash|rawerror|stack|details|hint)' then
        return false;
      end if;
      if not private.admin_user_safe_json(v_child) then
        return false;
      end if;
    end loop;
  elsif v_type = 'array' then
    for v_child in
      select value
      from jsonb_array_elements(p_value)
    loop
      if not private.admin_user_safe_json(v_child) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

revoke all on function private.admin_user_safe_json(jsonb) from public, anon, authenticated, service_role;

create table public.admin_user_operations (
  operation_id uuid primary key,
  actor_kind text not null check (actor_kind in ('central_admin', 'target_admin')),
  actor_uid uuid not null,
  action text not null check (action in ('list_users', 'create_user', 'reissue_temporary_password', 'suspend_user', 'reactivate_user', 'complete_password_change')),
  target_user_id uuid,
  target_email_normalized text,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'received' check (status in ('received', 'leased', 'provider_intent', 'provider_outcome', 'completed', 'quarantined', 'needs_review')),
  stage text not null default 'received' check (stage ~ '^[a-z0-9_]{1,64}$'),
  fence_version integer not null default 1 check (fence_version > 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_token_hash text check (lease_token_hash is null or lease_token_hash ~ '^[0-9a-f]{64}$'),
  lease_expires_at timestamptz,
  provider_intent_at timestamptz,
  provider_outcome_at timestamptz,
  safe_result jsonb check (safe_result is null or private.admin_user_safe_json(safe_result)),
  safe_error_code text check (safe_error_code is null or (char_length(safe_error_code) between 1 and 64 and safe_error_code ~ '^[a-z0-9_]+$')),
  safe_error_message text check (safe_error_message is null or char_length(safe_error_message) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint admin_user_operations_target_email_check check (
    (action = 'list_users' and target_email_normalized is null)
    or (
      action <> 'list_users'
      and target_email_normalized is not null
      and target_email_normalized = lower(btrim(target_email_normalized))
      and target_email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  constraint admin_user_operations_lease_pair_check check (
    (lease_token_hash is null and lease_expires_at is null)
    or (lease_token_hash is not null and lease_expires_at is not null)
  )
);

create table public.admin_user_mutation_locks (
  target_email_normalized text primary key
    check (
      target_email_normalized = lower(btrim(target_email_normalized))
      and target_email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  operation_id uuid not null references public.admin_user_operations(operation_id),
  owner_kind text not null check (owner_kind in ('central_operation', 'password_change')),
  state text not null check (state in ('leased', 'quarantined')),
  fence_version integer not null check (fence_version > 0),
  lease_token_hash text not null check (lease_token_hash ~ '^[0-9a-f]{64}$'),
  lease_expires_at timestamptz not null,
  quarantine_code text check (quarantine_code is null or (char_length(quarantine_code) between 1 and 64 and quarantine_code ~ '^[a-z0-9_]+$')),
  quarantine_reason text check (quarantine_reason is null or char_length(quarantine_reason) between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_user_operations_target_user_id_idx
  on public.admin_user_operations (target_user_id)
  where target_user_id is not null;

alter table public.admin_user_operations enable row level security;
alter table public.admin_user_operations force row level security;
alter table public.admin_user_mutation_locks enable row level security;
alter table public.admin_user_mutation_locks force row level security;

revoke all on table public.admin_user_operations, public.admin_user_mutation_locks from public, anon, authenticated;
revoke all on table public.admin_user_operations, public.admin_user_mutation_locks from service_role;

create or replace function private.admin_user_operation_record(
  p_operation public.admin_user_operations
)
returns jsonb
language sql
stable
set search_path = pg_catalog, public, private, extensions
as $$
  select jsonb_build_object(
    'operation_id', p_operation.operation_id,
    'actor_kind', p_operation.actor_kind,
    'actor_uid', p_operation.actor_uid,
    'action', p_operation.action,
    'target_user_id', p_operation.target_user_id,
    'target_email_normalized', p_operation.target_email_normalized,
    'request_hash', p_operation.request_hash,
    'status', p_operation.status,
    'stage', p_operation.stage,
    'fence_version', p_operation.fence_version,
    'attempt_count', p_operation.attempt_count,
    'lease_expires_at', p_operation.lease_expires_at,
    'safe_result', p_operation.safe_result,
    'safe_error_code', p_operation.safe_error_code,
    'safe_error_message', p_operation.safe_error_message
  );
$$;

revoke all on function private.admin_user_operation_record(public.admin_user_operations) from public, anon, authenticated;
revoke all on function private.admin_user_operation_record(public.admin_user_operations) from service_role;

create or replace function private.claim_admin_user_operation_impl(
  p_operation_id uuid,
  p_actor_kind text,
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
  v_inserted boolean;
  v_now timestamptz := clock_timestamp();
  v_lease_expires_at timestamptz;
  v_fence_version integer := 1;
  v_owner_kind text;
begin
  if p_lease_seconds is null or p_lease_seconds < 1 or p_lease_seconds > 300 then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;
  if p_lease_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  v_lease_expires_at := v_now + make_interval(secs => p_lease_seconds);
  v_owner_kind := case
    when p_action = 'complete_password_change' then 'password_change'
    else 'central_operation'
  end;

  if p_target_email_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_target_email_normalized, 0));
  end if;

  insert into public.admin_user_operations (
    operation_id,
    actor_kind,
    actor_uid,
    action,
    target_user_id,
    target_email_normalized,
    request_hash
  )
  values (
    p_operation_id,
    p_actor_kind,
    p_actor_uid,
    p_action,
    p_target_user_id,
    p_target_email_normalized,
    p_request_hash
  )
  on conflict (operation_id) do nothing;

  v_inserted := found;

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.actor_kind <> p_actor_kind
    or v_operation.actor_uid <> p_actor_uid
    or v_operation.action <> p_action
    or v_operation.target_user_id is distinct from p_target_user_id
    or v_operation.target_email_normalized is distinct from p_target_email_normalized
    or v_operation.request_hash <> p_request_hash
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

  if not v_inserted then
    return jsonb_build_object(
      'operation', private.admin_user_operation_record(v_operation),
      'disposition', 'exact_retry',
      'lease_token_accepted', v_operation.lease_token_hash = p_lease_token_hash
    );
  end if;

  if p_target_email_normalized is not null then
    insert into public.admin_user_mutation_locks (
      target_email_normalized,
      operation_id,
      owner_kind,
      state,
      fence_version,
      lease_token_hash,
      lease_expires_at
    )
    values (
      p_target_email_normalized,
      p_operation_id,
      v_owner_kind,
      'leased',
      1,
      p_lease_token_hash,
      v_lease_expires_at
    )
    on conflict (target_email_normalized) do nothing;

    if not found then
      select *
      into strict v_lock
      from public.admin_user_mutation_locks
      where target_email_normalized = p_target_email_normalized
      for update;

      if v_lock.state = 'quarantined' then
        update public.admin_user_operations
        set status = 'quarantined',
            stage = 'quarantined',
            safe_error_code = coalesce(v_lock.quarantine_code, 'operation_quarantined'),
            safe_error_message = coalesce(v_lock.quarantine_reason, 'The operation is permanently quarantined.'),
            updated_at = v_now
        where operation_id = p_operation_id
        returning * into strict v_operation;

        return jsonb_build_object(
          'operation', private.admin_user_operation_record(v_operation),
          'disposition', 'first_claim',
          'lease_token_accepted', false
        );
      end if;

      if v_lock.lease_expires_at > v_now then
        raise exception using errcode = 'P0001', message = 'lease_conflict';
      end if;

      select *
      into strict v_operation
      from public.admin_user_operations
      where operation_id = v_lock.operation_id
      for update;

      if v_operation.status in ('provider_intent', 'provider_outcome', 'needs_review', 'quarantined') then
        update public.admin_user_mutation_locks
        set state = 'quarantined',
            quarantine_code = 'provider_ambiguous',
            quarantine_reason = 'Provider outcome is ambiguous.',
            updated_at = v_now
        where target_email_normalized = p_target_email_normalized;

        update public.admin_user_operations
        set status = 'quarantined',
            stage = 'quarantined',
            safe_error_code = 'provider_ambiguous',
            safe_error_message = 'Provider outcome is ambiguous.',
            lease_expires_at = null,
            lease_token_hash = null,
            updated_at = v_now
        where operation_id in (v_lock.operation_id, p_operation_id);

        select *
        into strict v_operation
        from public.admin_user_operations
        where operation_id = p_operation_id;

        return jsonb_build_object(
          'operation', private.admin_user_operation_record(v_operation),
          'disposition', 'first_claim',
          'lease_token_accepted', false
        );
      end if;

      v_fence_version := v_lock.fence_version + 1;

      update public.admin_user_mutation_locks
      set operation_id = p_operation_id,
          owner_kind = v_owner_kind,
          state = 'leased',
          fence_version = v_fence_version,
          lease_token_hash = p_lease_token_hash,
          lease_expires_at = v_lease_expires_at,
          quarantine_code = null,
          quarantine_reason = null,
          updated_at = v_now
      where target_email_normalized = p_target_email_normalized;
    end if;
  end if;

  update public.admin_user_operations
  set status = 'leased',
      stage = 'claimed',
      fence_version = v_fence_version,
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

create or replace function public.claim_admin_user_operation(
  p_operation_id uuid,
  p_actor_kind text,
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
  return private.claim_admin_user_operation_impl(
    p_operation_id,
    p_actor_kind,
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

create or replace function private.renew_admin_user_operation_lease_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_current_lease_token_hash text,
  p_new_lease_token_hash text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_lease_expires_at timestamptz;
  v_target_email_normalized text;
begin
  if p_lease_seconds is null or p_lease_seconds < 1 or p_lease_seconds > 300
    or p_current_lease_token_hash !~ '^[0-9a-f]{64}$'
    or p_new_lease_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  select target_email_normalized
  into v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_target_email_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_target_email_normalized, 0));
  end if;

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.status in ('quarantined', 'needs_review') then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  if v_operation.status = 'completed' then
    return jsonb_build_object(
      'operation', private.admin_user_operation_record(v_operation),
      'disposition', 'completed_retry',
      'lease_token_accepted', false
    );
  end if;

  if v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_current_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  if v_target_email_normalized is not null then
    perform 1
    from public.admin_user_mutation_locks
    where target_email_normalized = v_target_email_normalized
      and operation_id = p_operation_id
      and fence_version = p_fence_version
      and lease_token_hash = p_current_lease_token_hash
      and state = 'leased'
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'lease_lost';
    end if;
  end if;

  v_lease_expires_at := v_now + make_interval(secs => p_lease_seconds);

  update public.admin_user_operations
  set lease_token_hash = p_new_lease_token_hash,
      lease_expires_at = v_lease_expires_at,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  if v_target_email_normalized is not null then
    update public.admin_user_mutation_locks
    set lease_token_hash = p_new_lease_token_hash,
        lease_expires_at = v_lease_expires_at,
        updated_at = v_now
    where target_email_normalized = v_target_email_normalized;
  end if;

  return jsonb_build_object(
    'operation', private.admin_user_operation_record(v_operation),
    'disposition', 'exact_retry',
    'lease_token_accepted', true
  );
end;
$$;

create or replace function public.renew_admin_user_operation_lease(
  p_operation_id uuid,
  p_fence_version integer,
  p_current_lease_token_hash text,
  p_new_lease_token_hash text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.renew_admin_user_operation_lease_impl(
    p_operation_id,
    p_fence_version,
    p_current_lease_token_hash,
    p_new_lease_token_hash,
    p_lease_seconds
  );
end;
$$;

create or replace function private.commit_admin_user_operation_stage_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
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
  v_now timestamptz := clock_timestamp();
  v_target_email_normalized text;
begin
  if p_stage not in ('provider_intent', 'provider_outcome')
    or (
      p_safe_result is not null
      and not private.admin_user_safe_json(p_safe_result)
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_target_email_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_target_email_normalized, 0));
  end if;

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.status in ('quarantined', 'needs_review') then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  if v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  if (p_stage = 'provider_intent' and v_operation.status <> 'leased')
    or (p_stage = 'provider_outcome' and v_operation.status <> 'provider_intent')
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if p_target_user_id is not null then
    if v_operation.target_user_id is not null
      and v_operation.target_user_id <> p_target_user_id
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    elsif v_operation.target_user_id is null
      and (
        v_operation.action <> 'create_user'
        or p_stage <> 'provider_outcome'
      )
    then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;
  end if;

  if v_target_email_normalized is not null then
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
  end if;

  update public.admin_user_operations
  set status = p_stage,
      stage = p_stage,
      target_user_id = case
        when target_user_id is null
          and action = 'create_user'
          and p_stage = 'provider_outcome'
        then p_target_user_id
        else target_user_id
      end,
      safe_result = case when p_stage = 'provider_outcome' then p_safe_result else safe_result end,
      provider_intent_at = case when p_stage = 'provider_intent' then v_now else provider_intent_at end,
      provider_outcome_at = case when p_stage = 'provider_outcome' then v_now else provider_outcome_at end,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.commit_admin_user_operation_stage(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
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
  return private.commit_admin_user_operation_stage_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_stage,
    p_target_user_id,
    p_safe_result
  );
end;
$$;

create or replace function private.complete_admin_user_operation_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_safe_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_target_email_normalized text;
begin
  if p_safe_result is not null
    and not private.admin_user_safe_json(p_safe_result)
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_target_email_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_target_email_normalized, 0));
  end if;

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.status = 'completed' then
    return private.admin_user_operation_record(v_operation);
  end if;

  if v_operation.status in ('quarantined', 'needs_review') then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  if p_fence_version is null
    or p_lease_token_hash is null
    or v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  if v_target_email_normalized is not null then
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
  end if;

  update public.admin_user_operations
  set status = 'completed',
      stage = 'completed',
      safe_result = coalesce(p_safe_result, safe_result),
      lease_token_hash = null,
      lease_expires_at = null,
      completed_at = v_now,
      updated_at = v_now
  where operation_id = p_operation_id
  returning * into strict v_operation;

  if v_target_email_normalized is not null then
    delete from public.admin_user_mutation_locks
    where target_email_normalized = v_target_email_normalized
      and operation_id = p_operation_id;
  end if;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.complete_admin_user_operation(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_safe_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.complete_admin_user_operation_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_safe_result
  );
end;
$$;

create or replace function private.quarantine_admin_user_operation_impl(
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
  v_now timestamptz := clock_timestamp();
  v_target_email_normalized text;
  v_error_message text;
begin
  v_error_message := case p_error_code
    when 'provider_ambiguous' then 'Provider outcome is ambiguous.'
    when 'lease_lost' then 'The operation lease was lost.'
    else null
  end;

  if v_error_message is null then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_target_email_normalized is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_target_email_normalized, 0));
  end if;

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.status = 'quarantined' then
    return private.admin_user_operation_record(v_operation);
  end if;

  if v_operation.status = 'completed' then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  if v_target_email_normalized is not null then
    perform 1
    from public.admin_user_mutation_locks
    where target_email_normalized = v_target_email_normalized
      and operation_id = p_operation_id
      and fence_version = p_fence_version
      and lease_token_hash = p_lease_token_hash
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'lease_lost';
    end if;

    update public.admin_user_mutation_locks
    set state = 'quarantined',
        quarantine_code = p_error_code,
        quarantine_reason = v_error_message,
        updated_at = v_now
    where target_email_normalized = v_target_email_normalized;
  end if;

  update public.admin_user_operations
  set status = 'quarantined',
      stage = 'quarantined',
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

create or replace function public.quarantine_admin_user_operation(
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
  return private.quarantine_admin_user_operation_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_error_code
  );
end;
$$;

create or replace function private.claim_forced_password_change_impl(
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
    select 1
    from public.admin_users
    where user_id = p_target_user_id
      and email = p_target_email_normalized
  ) then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  return private.claim_admin_user_operation_impl(
    p_operation_id,
    'target_admin',
    p_actor_uid,
    'complete_password_change',
    p_target_user_id,
    p_target_email_normalized,
    p_request_hash,
    p_lease_token_hash,
    p_lease_seconds
  );
end;
$$;

create or replace function public.claim_forced_password_change(
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
  return private.claim_forced_password_change_impl(
    p_operation_id,
    p_actor_uid,
    p_target_user_id,
    p_target_email_normalized,
    p_request_hash,
    p_lease_token_hash,
    p_lease_seconds
  );
end;
$$;

create or replace function private.advance_forced_password_change_impl(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_stage text,
  p_safe_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_operation public.admin_user_operations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_target_email_normalized text;
begin
  if p_stage in ('provider_intent', 'provider_outcome')
    or p_stage !~ '^[a-z0-9_]{1,64}$'
    or (
      p_safe_result is not null
      and not private.admin_user_safe_json(p_safe_result)
    )
  then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  select target_email_normalized
  into v_target_email_normalized
  from public.admin_user_operations
  where operation_id = p_operation_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_target_email_normalized, 0));

  select *
  into strict v_operation
  from public.admin_user_operations
  where operation_id = p_operation_id
  for update;

  if v_operation.action <> 'complete_password_change' then
    raise exception using errcode = 'P0001', message = 'operation_conflict';
  end if;

  if v_operation.status in ('quarantined', 'needs_review') then
    raise exception using errcode = 'P0001', message = 'operation_quarantined';
  end if;

  if v_operation.status = 'completed' then
    return private.admin_user_operation_record(v_operation);
  end if;

  if v_operation.fence_version <> p_fence_version
    or v_operation.lease_token_hash <> p_lease_token_hash
    or v_operation.lease_expires_at <= v_now
  then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  perform 1
  from public.admin_user_mutation_locks
  where target_email_normalized = v_target_email_normalized
    and operation_id = p_operation_id
    and owner_kind = 'password_change'
    and fence_version = p_fence_version
    and lease_token_hash = p_lease_token_hash
    and state = 'leased'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'lease_lost';
  end if;

  if p_stage = 'completed' then
    update public.admin_users
    set must_change_password = false,
        credential_version = credential_version + 1
    where user_id = v_operation.target_user_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'operation_conflict';
    end if;

    update public.admin_user_operations
    set status = 'completed',
        stage = 'completed',
        safe_result = p_safe_result,
        lease_token_hash = null,
        lease_expires_at = null,
        completed_at = v_now,
        updated_at = v_now
    where operation_id = p_operation_id
    returning * into strict v_operation;

    delete from public.admin_user_mutation_locks
    where target_email_normalized = v_target_email_normalized
      and operation_id = p_operation_id;
  else
    update public.admin_user_operations
    set stage = p_stage,
        safe_result = p_safe_result,
        updated_at = v_now
    where operation_id = p_operation_id
    returning * into strict v_operation;
  end if;

  return private.admin_user_operation_record(v_operation);
end;
$$;

create or replace function public.advance_forced_password_change(
  p_operation_id uuid,
  p_fence_version integer,
  p_lease_token_hash text,
  p_stage text,
  p_safe_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
begin
  return private.advance_forced_password_change_impl(
    p_operation_id,
    p_fence_version,
    p_lease_token_hash,
    p_stage,
    p_safe_result
  );
end;
$$;

revoke all on function private.claim_admin_user_operation_impl(uuid, text, uuid, text, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function private.renew_admin_user_operation_lease_impl(uuid, integer, text, text, integer) from public, anon, authenticated;
revoke all on function private.commit_admin_user_operation_stage_impl(uuid, integer, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.complete_admin_user_operation_impl(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function private.quarantine_admin_user_operation_impl(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function private.claim_forced_password_change_impl(uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function private.advance_forced_password_change_impl(uuid, integer, text, text, jsonb) from public, anon, authenticated;

revoke all on function public.claim_admin_user_operation(uuid, text, uuid, text, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.renew_admin_user_operation_lease(uuid, integer, text, text, integer) from public, anon, authenticated;
revoke all on function public.commit_admin_user_operation_stage(uuid, integer, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.complete_admin_user_operation(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.quarantine_admin_user_operation(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.claim_forced_password_change(uuid, uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.advance_forced_password_change(uuid, integer, text, text, jsonb) from public, anon, authenticated;

revoke usage on schema private from service_role;

revoke all on function private.claim_admin_user_operation_impl(uuid, text, uuid, text, uuid, text, text, text, integer) from service_role;
revoke all on function private.renew_admin_user_operation_lease_impl(uuid, integer, text, text, integer) from service_role;
revoke all on function private.commit_admin_user_operation_stage_impl(uuid, integer, text, text, uuid, jsonb) from service_role;
revoke all on function private.complete_admin_user_operation_impl(uuid, integer, text, jsonb) from service_role;
revoke all on function private.quarantine_admin_user_operation_impl(uuid, integer, text, text) from service_role;
revoke all on function private.claim_forced_password_change_impl(uuid, uuid, uuid, text, text, text, integer) from service_role;
revoke all on function private.advance_forced_password_change_impl(uuid, integer, text, text, jsonb) from service_role;

grant execute on function public.claim_admin_user_operation(uuid, text, uuid, text, uuid, text, text, text, integer) to service_role;
grant execute on function public.renew_admin_user_operation_lease(uuid, integer, text, text, integer) to service_role;
grant execute on function public.commit_admin_user_operation_stage(uuid, integer, text, text, uuid, jsonb) to service_role;
grant execute on function public.complete_admin_user_operation(uuid, integer, text, jsonb) to service_role;
grant execute on function public.quarantine_admin_user_operation(uuid, integer, text, text) to service_role;
grant execute on function public.claim_forced_password_change(uuid, uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.advance_forced_password_change(uuid, integer, text, text, jsonb) to service_role;

notify pgrst, 'reload schema';
