-- The preceding site-settings RLS repair replaces this helper with the
-- pre-fence predicate. Restore the credential fence after that repair.
create or replace function private.is_home_config_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version_json jsonb;
  v_version_text text;
  v_jwt_credential_version integer;
begin
  if v_uid is null then
    return false;
  end if;

  v_version_json := auth.jwt() -> 'app_metadata' -> 'credential_version';
  if v_version_json is null
    or pg_catalog.jsonb_typeof(v_version_json) <> 'number'
  then
    return false;
  end if;

  v_version_text := v_version_json #>> '{}';
  if v_version_text is null
    or pg_catalog.char_length(v_version_text) > 10
    or v_version_text !~ '^[1-9][0-9]*$'
  then
    return false;
  end if;

  if v_version_text::numeric > 2147483647 then
    return false;
  end if;
  v_jwt_credential_version := v_version_text::integer;

  return exists (
    select 1
    from public.admin_users as admin_user
    where admin_user.user_id = v_uid
      and admin_user.role = 'admin'
      and admin_user.is_active = true
      and admin_user.must_change_password = false
      and admin_user.credential_version > 0
      and admin_user.credential_version = v_jwt_credential_version
  );
end;
$$;

alter function private.is_home_config_admin() owner to postgres;
revoke all on function private.is_home_config_admin()
  from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_home_config_admin() to authenticated;

notify pgrst, 'reload schema';
