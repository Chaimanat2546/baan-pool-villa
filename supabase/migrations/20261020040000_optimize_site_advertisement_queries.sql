-- Global ordering also supports MAX(sort_order) during automatic append allocation.
create index if not exists site_advertisements_order_idx
  on public.site_advertisements (sort_order, id);

create extension if not exists pg_trgm with schema extensions;
-- Respect pg_trgm's existing schema instead of moving a shared extension.
do $migration$
declare v_schema name;
begin
  select n.nspname into strict v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm';
  execute format(
    'create index if not exists site_advertisements_title_trgm_idx on public.site_advertisements using gin (title %I.gin_trgm_ops)',
    v_schema
  );
end;
$migration$;

-- ILIKE is not leakproof: querying through RLS can prevent use of the GIN index.
-- Authorize inside a private definer, then run a bound, narrowly scoped read.
create or replace function private.list_site_advertisements_impl(
  p_page integer, p_search text, p_zone text, p_status text
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $function$
declare
  v_search text := btrim(coalesce(p_search, ''));
  v_zone text := btrim(coalesce(p_zone, ''));
  v_pattern text;
  v_where text := ' where true';
  v_result jsonb;
begin
  if not coalesce(private.is_home_config_admin(), false) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_page is null or p_page not between 1 and 99999
    or char_length(v_search) > 160
    or v_zone not in ('','all','pattaya','jomtien','bangsaray','sattahip','bangsean','rayong','hua_hin','khaoyai','bangkok')
    or p_status is null or p_status not in ('all','active','inactive') then
    raise exception 'Invalid advertisement list filters' using errcode = '22023';
  end if;
  v_pattern := '%' || replace(replace(replace(v_search,
    chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%';
  -- Only fixed SQL fragments are appended. Every request value stays a bind parameter.
  if v_search <> '' then v_where := v_where || ' and a.title ilike $1'; end if;
  if v_zone <> '' then v_where := v_where || ' and a.zone = $2'; end if;
  if p_status <> 'all' then v_where := v_where || ' and a.is_active = $3'; end if;
  execute
    'select jsonb_build_object(
      ''total'', (select count(*) from public.site_advertisements a' || v_where || '),
      ''advertisements'', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.sort_order, r.id)
        from (
          select a.id, a.title, a.zone, a.is_active, a.sort_order, a.updated_at,
            (select coalesce(jsonb_agg(jsonb_build_object(
              ''id'', i.id, ''storage_path'', i.storage_path, ''display_order'', i.display_order
            ) order by i.display_order), ''[]''::jsonb)
            from public.site_advertisement_images i where i.advertisement_id = a.id
            ) as site_advertisement_images
          from public.site_advertisements a' || v_where || '
          order by a.sort_order, a.id limit 8 offset $4
        ) r
      ), ''[]''::jsonb)
    )'
    into v_result using v_pattern, v_zone, p_status = 'active', (p_page - 1) * 8;
  return v_result;
end;
$function$;

create or replace function public.list_site_advertisements(
  p_page integer default 1, p_search text default '', p_zone text default '', p_status text default 'all'
)
returns jsonb language sql stable security invoker set search_path = pg_catalog as $function$
  select private.list_site_advertisements_impl(p_page, p_search, p_zone, p_status);
$function$;
revoke all on function private.list_site_advertisements_impl(integer,text,text,text),
  public.list_site_advertisements(integer,text,text,text) from public, anon;
grant execute on function private.list_site_advertisements_impl(integer,text,text,text),
  public.list_site_advertisements(integer,text,text,text) to authenticated;

analyze public.site_advertisements;
notify pgrst, 'reload schema';
