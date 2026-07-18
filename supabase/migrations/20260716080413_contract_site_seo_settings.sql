do $$
declare
  canonical_count integer;
  dependency_count integer;
  dependency_names text[];
  legacy_columns constant text[] := array[
    'seo_title',
    'seo_description',
    'seo_keywords',
    'seo_og_image_url',
    'seo_og_image_alt',
    'seo_business_name',
    'seo_same_as_urls',
    'search_seo_title',
    'search_seo_description',
    'search_seo_keywords',
    'search_seo_og_image_url',
    'search_seo_og_image_alt',
    'guides_seo_title',
    'guides_seo_description',
    'guides_seo_keywords',
    'guides_seo_og_image_url',
    'guides_seo_og_image_alt',
    'villa_detail_seo_keywords'
  ];
begin
  select count(*) into canonical_count
  from public.site_seo_settings
  where page_type in ('global', 'search', 'guides', 'villa_detail');

  if canonical_count <> 4 then
    raise exception 'Cannot remove legacy SEO columns: expected 4 canonical rows, found %', canonical_count;
  end if;

  with dependency_candidates as (
    select format('view %I.%I', view_schema.nspname, view_class.relname) as dependency_name
    from pg_catalog.pg_depend dependency
    join pg_catalog.pg_rewrite rewrite
      on dependency.classid = 'pg_catalog.pg_rewrite'::regclass
      and dependency.objid = rewrite.oid
    join pg_catalog.pg_class view_class on view_class.oid = rewrite.ev_class
    join pg_catalog.pg_namespace view_schema on view_schema.oid = view_class.relnamespace
    join pg_catalog.pg_attribute referenced_column
      on referenced_column.attrelid = dependency.refobjid
      and referenced_column.attnum = dependency.refobjsubid
    where dependency.refclassid = 'pg_catalog.pg_class'::regclass
      and dependency.refobjid = 'public.site_settings'::regclass
      and referenced_column.attname = any (legacy_columns)
      and view_class.relkind in ('v', 'm')
      and view_schema.nspname !~ '^pg_'
      and view_schema.nspname <> 'information_schema'

    union

    select format('function %s', function_definition.oid::regprocedure)
    from pg_catalog.pg_depend dependency
    join pg_catalog.pg_proc function_definition
      on dependency.classid = 'pg_catalog.pg_proc'::regclass
      and dependency.objid = function_definition.oid
    join pg_catalog.pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    join pg_catalog.pg_attribute referenced_column
      on referenced_column.attrelid = dependency.refobjid
      and referenced_column.attnum = dependency.refobjsubid
    where dependency.refclassid = 'pg_catalog.pg_class'::regclass
      and dependency.refobjid = 'public.site_settings'::regclass
      and referenced_column.attname = any (legacy_columns)
      and function_schema.nspname !~ '^pg_'
      and function_schema.nspname <> 'information_schema'

    union

    select format('function %s', function_definition.oid::regprocedure)
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    where function_definition.prokind in ('f', 'p')
      and function_schema.nspname !~ '^pg_'
      and function_schema.nspname <> 'information_schema'
      and exists (
        select 1
        from unnest(legacy_columns) legacy_column
        where position(legacy_column in lower(pg_catalog.pg_get_functiondef(function_definition.oid))) > 0
      )
  ), named_dependencies as (
    select distinct dependency_name
    from dependency_candidates
  )
  select
    count(*),
    (array_agg(dependency_name order by dependency_name))[1:20]
  into dependency_count, dependency_names
  from named_dependencies;

  if dependency_count > 0 then
    raise exception
      'Cannot remove legacy SEO columns: found % user-defined dependencies: % %',
      dependency_count,
      array_to_string(dependency_names, ', '),
      case when dependency_count > 20 then ' (first 20 shown)' else '' end;
  end if;
end
$$;

alter table public.site_settings
  drop column if exists seo_title,
  drop column if exists seo_description,
  drop column if exists seo_keywords,
  drop column if exists seo_og_image_url,
  drop column if exists seo_og_image_alt,
  drop column if exists seo_business_name,
  drop column if exists seo_same_as_urls,
  drop column if exists search_seo_title,
  drop column if exists search_seo_description,
  drop column if exists search_seo_keywords,
  drop column if exists search_seo_og_image_url,
  drop column if exists search_seo_og_image_alt,
  drop column if exists guides_seo_title,
  drop column if exists guides_seo_description,
  drop column if exists guides_seo_keywords,
  drop column if exists guides_seo_og_image_url,
  drop column if exists guides_seo_og_image_alt,
  drop column if exists villa_detail_seo_keywords;

notify pgrst, 'reload schema';

select
  (
    select count(*)
    from public.site_seo_settings
    where page_type in ('global', 'search', 'guides', 'villa_detail')
  ) as canonical_row_count,
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name in (
        'seo_title',
        'seo_description',
        'seo_keywords',
        'seo_og_image_url',
        'seo_og_image_alt',
        'seo_business_name',
        'seo_same_as_urls',
        'search_seo_title',
        'search_seo_description',
        'search_seo_keywords',
        'search_seo_og_image_url',
        'search_seo_og_image_alt',
        'guides_seo_title',
        'guides_seo_description',
        'guides_seo_keywords',
        'guides_seo_og_image_url',
        'guides_seo_og_image_alt',
        'villa_detail_seo_keywords'
      )
  ) as legacy_column_count,
  (
    select count(*)
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    where function_definition.prokind in ('f', 'p')
      and function_schema.nspname !~ '^pg_'
      and function_schema.nspname <> 'information_schema'
      and exists (
        select 1
        from unnest(array[
          'seo_title',
          'seo_description',
          'seo_keywords',
          'seo_og_image_url',
          'seo_og_image_alt',
          'seo_business_name',
          'seo_same_as_urls',
          'search_seo_title',
          'search_seo_description',
          'search_seo_keywords',
          'search_seo_og_image_url',
          'search_seo_og_image_alt',
          'guides_seo_title',
          'guides_seo_description',
          'guides_seo_keywords',
          'guides_seo_og_image_url',
          'guides_seo_og_image_alt',
          'villa_detail_seo_keywords'
        ]) legacy_column
        where position(legacy_column in lower(pg_catalog.pg_get_functiondef(function_definition.oid))) > 0
      )
  ) as dependency_count;
