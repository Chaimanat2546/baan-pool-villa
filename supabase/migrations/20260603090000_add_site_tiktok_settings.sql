alter table public.site_settings
  add column if not exists tiktok_account_url text not null default '',
  add column if not exists tiktok_video_urls jsonb not null default '[]'::jsonb;

update public.site_settings
set
  tiktok_account_url = coalesce(nullif(trim(tiktok_account_url), ''), ''),
  tiktok_video_urls = case
    when jsonb_typeof(tiktok_video_urls) = 'array' then tiktok_video_urls
    else '[]'::jsonb
  end
where id = 'global';

notify pgrst, 'reload schema';
