alter table public.site_settings
  add column if not exists header_link_color text not null default '#ffffff',
  add column if not exists header_link_hover_color text not null default '#eab308',
  add column if not exists footer_link_color text not null default '#ffffff',
  add column if not exists footer_link_hover_color text not null default '#eab308',
  add column if not exists bank_highlight_color text not null default '#eab308';

update public.site_settings
set
  header_link_color = case
    when header_link_color ~ '^#[0-9A-Fa-f]{6}$' then lower(header_link_color)
    else '#ffffff'
  end,
  header_link_hover_color = case
    when header_link_hover_color ~ '^#[0-9A-Fa-f]{6}$' then lower(header_link_hover_color)
    else '#eab308'
  end,
  footer_link_color = case
    when footer_link_color ~ '^#[0-9A-Fa-f]{6}$' then lower(footer_link_color)
    else '#ffffff'
  end,
  footer_link_hover_color = case
    when footer_link_hover_color ~ '^#[0-9A-Fa-f]{6}$' then lower(footer_link_hover_color)
    else '#eab308'
  end,
  bank_highlight_color = case
    when bank_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_highlight_color)
    else '#eab308'
  end
where id = 'global';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_header_link_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_header_link_color_hex
      check (header_link_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_header_link_hover_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_header_link_hover_color_hex
      check (header_link_hover_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_footer_link_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_footer_link_color_hex
      check (footer_link_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_footer_link_hover_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_footer_link_hover_color_hex
      check (footer_link_hover_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_bank_highlight_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_bank_highlight_color_hex
      check (bank_highlight_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end;
$$;

notify pgrst, 'reload schema';
