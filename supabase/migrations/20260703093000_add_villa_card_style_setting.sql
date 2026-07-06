alter table public.site_settings
  add column if not exists villa_card_style text not null default 'classic';

update public.site_settings
set villa_card_style = 'classic'
where villa_card_style is null
  or villa_card_style not in ('classic', 'gallery');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_settings_villa_card_style_allowed'
  ) then
    alter table public.site_settings
      add constraint site_settings_villa_card_style_allowed
      check (villa_card_style in ('classic', 'gallery'));
  end if;
end $$;

notify pgrst, 'reload schema';
