create table if not exists public.site_web_styles (
  style_type text primary key,
  style_variant text not null,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_web_styles_type_check
    check (style_type in ('header', 'gallery', 'house_card')),
  constraint site_web_styles_variant_check
    check (
      (style_type = 'header' and style_variant in ('centered-contact', 'right-booking'))
      or (style_type = 'gallery' and style_variant in ('lightbox', 'categorized-grid'))
      or (style_type = 'house_card' and style_variant in ('classic', 'gallery'))
    ),
  constraint site_web_styles_options_object_check
    check (jsonb_typeof(options) = 'object'),
  constraint site_web_styles_options_check
    check (
      (style_type in ('header', 'house_card') and options = '{}'::jsonb)
      or (
        style_type = 'gallery'
        and options - 'backgroundColor' - 'textColor' - 'categoryOrder' = '{}'::jsonb
        and (
          not (options ? 'backgroundColor')
          or (
            jsonb_typeof(options -> 'backgroundColor') = 'string'
            and options ->> 'backgroundColor' ~ '^#[0-9A-Fa-f]{6}$'
          )
        )
        and (
          not (options ? 'textColor')
          or (
            jsonb_typeof(options -> 'textColor') = 'string'
            and options ->> 'textColor' ~ '^#[0-9A-Fa-f]{6}$'
          )
        )
        and (
          not (options ? 'categoryOrder')
          or (
            case when jsonb_typeof(options -> 'categoryOrder') = 'array' then
              jsonb_array_length(options -> 'categoryOrder') = 11
              and options -> 'categoryOrder' @> '["cover", "outside", "pool", "inside", "livingroom", "bedroom", "kitchen", "bathroom", "parking", "review", "uncategorized"]'::jsonb
            else false end
          )
        )
      )
    )
);

do $$
declare
  header_variant text := 'centered-contact';
  house_card_variant text := 'classic';
begin
  if to_regclass('public.site_header_settings') is not null then
    execute 'select desktop_header_variant from public.site_header_settings where singleton_id = true'
      into header_variant;
  end if;

  if header_variant not in ('centered-contact', 'right-booking') then
    header_variant := 'centered-contact';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name = 'villa_card_style'
  ) then
    execute 'select villa_card_style from public.site_settings where id = ''global'''
      into house_card_variant;
  end if;

  if house_card_variant not in ('classic', 'gallery') then
    house_card_variant := 'classic';
  end if;

  insert into public.site_web_styles (style_type, style_variant, options)
  values ('header', coalesce(header_variant, 'centered-contact'), '{}'::jsonb)
  on conflict (style_type) do update
  set style_variant = excluded.style_variant,
      options = excluded.options;

  insert into public.site_web_styles (style_type, style_variant, options)
  values ('house_card', coalesce(house_card_variant, 'classic'), '{}'::jsonb)
  on conflict (style_type) do update
  set style_variant = excluded.style_variant,
      options = excluded.options;
end
$$;

insert into public.site_web_styles (style_type, style_variant, options)
values ('gallery', 'lightbox', '{}'::jsonb)
on conflict (style_type) do nothing;

drop trigger if exists site_web_styles_set_updated_at
  on public.site_web_styles;

create trigger site_web_styles_set_updated_at
  before update on public.site_web_styles
  for each row execute function private.set_updated_at();

alter table public.site_web_styles enable row level security;

drop policy if exists "Anon and authenticated users can select site web styles"
  on public.site_web_styles;
create policy "Anon and authenticated users can select site web styles"
  on public.site_web_styles
  for select
  to anon, authenticated
  using (style_type in ('header', 'gallery', 'house_card'));

drop policy if exists "Authenticated admins can insert site web styles"
  on public.site_web_styles;
create policy "Authenticated admins can insert site web styles"
  on public.site_web_styles
  for insert
  to authenticated
  with check (
    style_type in ('header', 'gallery', 'house_card')
    and private.is_home_config_admin()
  );

drop policy if exists "Authenticated admins can update site web styles"
  on public.site_web_styles;
create policy "Authenticated admins can update site web styles"
  on public.site_web_styles
  for update
  to authenticated
  using (
    style_type in ('header', 'gallery', 'house_card')
    and private.is_home_config_admin()
  )
  with check (
    style_type in ('header', 'gallery', 'house_card')
    and private.is_home_config_admin()
  );

revoke all on table public.site_web_styles from anon, authenticated;
grant select on table public.site_web_styles to anon, authenticated;
grant insert, update on table public.site_web_styles to authenticated;

notify pgrst, 'reload schema';
