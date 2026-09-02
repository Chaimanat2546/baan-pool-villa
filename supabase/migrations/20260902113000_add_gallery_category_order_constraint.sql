alter table public.site_web_styles
  drop constraint if exists site_web_styles_options_check;

alter table public.site_web_styles
  add constraint site_web_styles_options_check
  check (
    (style_type in ('header', 'house_card') and options = '{}'::jsonb)
    or (
      style_type = 'gallery'
      and options - 'backgroundColor' - 'textColor' - 'categoryOrder' - 'showCover' = '{}'::jsonb
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
      and (
        not (options ? 'showCover')
        or jsonb_typeof(options -> 'showCover') = 'boolean'
      )
    )
  );

notify pgrst, 'reload schema';
