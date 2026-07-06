alter table public.site_settings
  add column if not exists bank_account_highlight_color text,
  add column if not exists bank_name_highlight_color text,
  add column if not exists bank_number_highlight_color text;

update public.site_settings
set
  bank_account_highlight_color = case
    when bank_account_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_account_highlight_color)
    when bank_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_highlight_color)
    else '#eab308'
  end,
  bank_name_highlight_color = case
    when bank_name_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_name_highlight_color)
    when bank_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_highlight_color)
    else '#eab308'
  end,
  bank_number_highlight_color = case
    when bank_number_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_number_highlight_color)
    when bank_highlight_color ~ '^#[0-9A-Fa-f]{6}$' then lower(bank_highlight_color)
    else '#eab308'
  end
where id = 'global';

alter table public.site_settings
  alter column bank_account_highlight_color set default '#eab308',
  alter column bank_account_highlight_color set not null,
  alter column bank_name_highlight_color set default '#eab308',
  alter column bank_name_highlight_color set not null,
  alter column bank_number_highlight_color set default '#eab308',
  alter column bank_number_highlight_color set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_bank_account_highlight_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_bank_account_highlight_color_hex
      check (bank_account_highlight_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_bank_name_highlight_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_bank_name_highlight_color_hex
      check (bank_name_highlight_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_bank_number_highlight_color_hex'
  ) then
    alter table public.site_settings
      add constraint site_settings_bank_number_highlight_color_hex
      check (bank_number_highlight_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end;
$$;

notify pgrst, 'reload schema';
