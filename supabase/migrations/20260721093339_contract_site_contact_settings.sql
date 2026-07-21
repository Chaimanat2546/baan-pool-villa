do $$
declare
  canonical_count integer;
  legacy_column_count integer;
  source_count integer;
  values_match boolean;
begin
  if to_regclass('public.site_contact_settings') is null then
    raise exception 'Cannot remove legacy contact columns: site_contact_settings is missing';
  end if;

  select count(*) into canonical_count
  from public.site_contact_settings
  where singleton_id;

  if canonical_count <> 1 then
    raise exception
      'Cannot remove legacy contact columns: expected 1 canonical row, found %',
      canonical_count;
  end if;

  select count(*) into source_count
  from public.site_settings
  where id = 'global';

  if source_count <> 1 then
    raise exception
      'Cannot remove legacy contact columns: expected 1 global source row, found %',
      source_count;
  end if;

  select count(*) into legacy_column_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'site_settings'
    and column_name in (
      'bank_account_name',
      'bank_name',
      'bank_account_number',
      'phone_contacts',
      'messenger_url',
      'line_id',
      'line_url'
    );

  if legacy_column_count <> 7 then
    raise exception
      'Cannot remove legacy contact columns: expected 7 legacy columns, found %',
      legacy_column_count;
  end if;

  execute $query$
    select
      s.bank_account_name = c.bank_account_name
      and s.bank_name = c.bank_name
      and s.bank_account_number = c.bank_account_number
      and s.phone_contacts = c.phone_contacts
      and s.messenger_url = c.messenger_url
      and s.line_id = c.line_id
      and s.line_url = c.line_url
    from public.site_settings s
    cross join public.site_contact_settings c
    where s.id = 'global'
      and c.singleton_id
  $query$ into values_match;

  if values_match is distinct from true then
    raise exception 'Cannot remove legacy contact columns: canonical values differ from legacy source';
  end if;
end
$$;

alter table public.site_settings
  drop column if exists bank_account_name,
  drop column if exists bank_name,
  drop column if exists bank_account_number,
  drop column if exists phone_contacts,
  drop column if exists messenger_url,
  drop column if exists line_id,
  drop column if exists line_url;

notify pgrst, 'reload schema';

select
  (select count(*)
   from public.site_contact_settings
   where singleton_id) as canonical_row_count,
  (select count(*)
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'site_settings'
     and column_name in (
       'bank_account_name',
       'bank_name',
       'bank_account_number',
       'phone_contacts',
       'messenger_url',
       'line_id',
       'line_url'
     )) as legacy_column_count;
