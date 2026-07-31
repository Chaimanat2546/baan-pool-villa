alter table public.site_settings
  add column if not exists hero_slides jsonb;

update public.site_settings
set hero_slides = jsonb_build_array(
  jsonb_build_object(
    'path', hero_image_path,
    'url', hero_image_url,
    'alt', coalesce(nullif(btrim(hero_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา')
  )
)
where hero_slides is null
  and hero_image_path is not null
  and hero_image_url is not null;
