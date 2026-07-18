-- Remove legacy site-style storage only after the canonical style rows exist.
do $$
declare
  has_legacy_contract boolean;
  canonical_style_count integer;
begin
  select
    to_regclass('public.site_header_settings') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'site_settings'
        and column_name = 'villa_card_style'
    )
  into has_legacy_contract;

  if has_legacy_contract then
    select count(*)
    into canonical_style_count
    from public.site_web_styles
    where style_type in ('gallery', 'header', 'house_card');

    if canonical_style_count <> 3 then
      raise exception
        'Cannot remove legacy site-style storage: expected canonical gallery, header, and house_card rows, found %',
        canonical_style_count;
    end if;
  end if;
end
$$;

-- Keep public settings readable while restricting mutations to authenticated admins via RLS.
revoke all on table public.site_settings from anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

drop policy if exists "Authenticated admins can delete site settings"
  on public.site_settings;

alter table public.site_settings
  drop column if exists villa_card_style;

drop table if exists public.site_header_settings;

notify pgrst, 'reload schema';
