create or replace function private.list_reconciled_admin_users_v1_impl(
  p_page integer,
  p_page_size integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offset integer;
  v_result jsonb;
begin
  if p_page is null
    or not (p_page between 1 and 100)
    or p_page_size is null
    or not (p_page_size between 1 and 100)
  then
    raise exception using
      errcode = 'P0001',
      message = 'profile_data_invalid';
  end if;

  v_offset := (p_page - 1) * p_page_size;

  with auth_source as (
    select
      u.id as user_id,
      pg_catalog.lower(pg_catalog.btrim(u.email)) as auth_email,
      u.created_at as auth_created_at,
      u.last_sign_in_at,
      u.confirmed_at,
      u.banned_until,
      (
        u.raw_app_meta_data -> 'bpv_admin_managed'
          = 'true'::pg_catalog.jsonb
      ) as auth_managed,
      case
        when pg_catalog.jsonb_typeof(
          u.raw_app_meta_data -> 'credential_version'
        ) = 'number'
          and (u.raw_app_meta_data ->> 'credential_version')
            ~ '^[1-9][0-9]{0,9}$'
          and (u.raw_app_meta_data ->> 'credential_version')::pg_catalog.numeric
            <= 2147483647
        then (u.raw_app_meta_data ->> 'credential_version')::pg_catalog.int4
        else null
      end as auth_credential_version
    from auth.users as u
    where u.email is not null
      and pg_catalog.btrim(u.email) <> ''
  ),
  profile_source as (
    select
      p.user_id,
      pg_catalog.lower(pg_catalog.btrim(p.email)) as profile_email,
      p.role,
      p.is_active,
      p.must_change_password,
      p.credential_version,
      p.created_at as profile_created_at
    from public.admin_users as p
  ),
  email_claims as (
    select auth_email as normalized_email, user_id from auth_source
    union
    select profile_email as normalized_email, user_id from profile_source
  ),
  email_ownership as (
    select normalized_email, pg_catalog.count(*) as owner_count
    from email_claims
    where normalized_email is not null
      and normalized_email <> ''
    group by normalized_email
  ),
  joined as (
    select
      coalesce(a.user_id, p.user_id) as user_id,
      coalesce(a.auth_email, p.profile_email) as display_email,
      a.auth_email,
      p.profile_email,
      a.auth_created_at,
      p.profile_created_at,
      a.last_sign_in_at,
      a.confirmed_at,
      a.banned_until,
      a.auth_managed,
      a.auth_credential_version,
      p.role,
      p.is_active,
      p.must_change_password,
      p.credential_version,
      a.user_id is not null as has_auth,
      p.user_id is not null as has_profile,
      coalesce(auth_owners.owner_count, 0) as auth_email_owners,
      coalesce(profile_owners.owner_count, 0) as profile_email_owners
    from auth_source as a
    full outer join profile_source as p
      on a.user_id = p.user_id
    left join email_ownership as auth_owners
      on auth_owners.normalized_email = a.auth_email
    left join email_ownership as profile_owners
      on profile_owners.normalized_email = p.profile_email
  ),
  assessed as (
    select
      user_id,
      display_email,
      case
        when not has_auth
          or not has_profile
          or display_email is null
          or display_email = ''
          or auth_email is distinct from profile_email
          or role is distinct from 'admin'
          or auth_managed is distinct from true
          or confirmed_at is null
          or auth_credential_version is null
          or credential_version is null
          or credential_version <= 0
          or auth_credential_version is distinct from credential_version
          or auth_email_owners > 1
          or profile_email_owners > 1
          or (
            is_active
            and banned_until is not null
            and banned_until > pg_catalog.statement_timestamp()
          )
          or (
            not is_active
            and (
              banned_until is null
              or banned_until <= pg_catalog.statement_timestamp()
            )
          )
        then 'abnormal'
        when not is_active then 'suspended'
        when must_change_password then 'password_change_required'
        else 'active'
      end as status,
      coalesce(auth_created_at, profile_created_at) as created_at,
      last_sign_in_at,
      credential_version,
      auth_credential_version
    from joined
  ),
  page_rows as (
    select *
    from assessed
    order by display_email asc, user_id asc
    offset v_offset
    limit p_page_size + 1
  ),
  numbered_page as (
    select
      page_rows.*,
      pg_catalog.row_number() over (
        order by display_email asc, user_id asc
      ) as page_position
    from page_rows
  )
  select pg_catalog.jsonb_build_object(
    'users',
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'userId', user_id,
          'email', display_email,
          'status', status,
          'createdAt', created_at,
          'lastSignInAt', last_sign_in_at,
          'credentialVersion', credential_version,
          'authCredentialVersion', auth_credential_version
        )
        order by display_email asc, user_id asc
      ) filter (where page_position <= p_page_size),
      '[]'::pg_catalog.jsonb
    ),
    'hasMore',
    p_page < 100 and pg_catalog.count(*) > p_page_size
  )
  into v_result
  from numbered_page;

  return v_result;
end;
$$;

revoke all on function private.list_reconciled_admin_users_v1_impl(
  integer,
  integer
) from public, anon, authenticated, service_role;
