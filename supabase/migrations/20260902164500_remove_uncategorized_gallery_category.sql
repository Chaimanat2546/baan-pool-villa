alter table public.site_web_styles
  drop constraint if exists site_web_styles_options_check;

update public.site_web_styles
set options = jsonb_set(
  options,
  '{categoryOrder}',
  coalesce(
    (
      select jsonb_agg(category_key)
      from jsonb_array_elements_text(options -> 'categoryOrder') as category_key
      where category_key <> 'uncategorized'
    ),
    '[]'::jsonb
  ),
  true
)
where style_type = 'gallery'
  and jsonb_typeof(options -> 'categoryOrder') = 'array'
  and options -> 'categoryOrder' ? 'uncategorized';

alter table public.site_web_styles
  add constraint site_web_styles_options_check check (
    (style_type = 'header' and options = '{}'::jsonb)
    or (style_type = 'house_card' and options = '{}'::jsonb)
    or (
      style_type = 'gallery'
      and (not (options ? 'backgroundColor') or (jsonb_typeof(options -> 'backgroundColor') = 'string' and options ->> 'backgroundColor' ~ '^#[0-9A-Fa-f]{6}$'))
      and (not (options ? 'textColor') or (jsonb_typeof(options -> 'textColor') = 'string' and options ->> 'textColor' ~ '^#[0-9A-Fa-f]{6}$'))
      and (not (options ? 'showCover') or jsonb_typeof(options -> 'showCover') = 'boolean')
      and (not (options ? 'imageSource') or (jsonb_typeof(options -> 'imageSource') = 'string' and options ->> 'imageSource' in ('standard', 'system')))
      and (not (options ? 'categoryOrder') or (case when jsonb_typeof(options -> 'categoryOrder') = 'array' then jsonb_array_length(options -> 'categoryOrder') = 10 and options -> 'categoryOrder' @> '["cover", "outside", "pool", "inside", "livingroom", "bedroom", "kitchen", "bathroom", "parking", "review"]'::jsonb else false end))
    )
  );

notify pgrst, 'reload schema';
