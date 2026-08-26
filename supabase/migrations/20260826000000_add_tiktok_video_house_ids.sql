-- Normalize TikTok video settings to object entries that can optionally link a villa.
update public.site_settings
set tiktok_video_urls = (
  with video_entries as (
    select item, ordinal
    from jsonb_array_elements(
      case
        when jsonb_typeof(tiktok_video_urls) = 'array' then tiktok_video_urls
        else '[]'::jsonb
      end
    ) with ordinality as entry(item, ordinal)
  ),
  normalized_entries as (
    select
      ordinal,
      case
        when jsonb_typeof(item) = 'string'
          and nullif(trim(item #>> '{}'), '') is not null then
          jsonb_build_object('url', trim(item #>> '{}'))
        when jsonb_typeof(item) = 'object'
          and jsonb_typeof(item -> 'url') = 'string'
          and nullif(trim(item ->> 'url'), '') is not null then
          case
            when jsonb_typeof(item -> 'houseId') = 'string'
              and nullif(trim(item ->> 'houseId'), '') is not null then
              jsonb_build_object(
                'url', trim(item ->> 'url'),
                'houseId', trim(item ->> 'houseId')
              )
            else jsonb_build_object('url', trim(item ->> 'url'))
          end
        else null
      end as normalized_entry
    from video_entries
  )
  select coalesce(
    jsonb_agg(normalized_entry order by ordinal)
      filter (where normalized_entry is not null),
    '[]'::jsonb
  )
  from normalized_entries
);

notify pgrst, 'reload schema';
