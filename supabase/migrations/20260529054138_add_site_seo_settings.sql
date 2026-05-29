alter table public.site_settings
  add column if not exists seo_title text not null default 'Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา',
  add column if not exists seo_description text not null default 'รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย',
  add column if not exists seo_og_image_url text not null default '/images/BPV-66_Cover-Web.jpg',
  add column if not exists seo_og_image_alt text not null default 'Pool Villa บ้านพูลวิลล่า พัทยา',
  add column if not exists seo_business_name text not null default 'Pool Villas Pattaya',
  add column if not exists seo_same_as_urls jsonb not null default '["https://www.facebook.com/baanpoolvillas","https://line.me/R/ti/p/@baanpoolvilla"]'::jsonb;

update public.site_settings
set
  seo_title = coalesce(nullif(trim(seo_title), ''), 'Pool Villas Pattaya | บ้านพักพูลวิลล่าพัทยา'),
  seo_description = coalesce(nullif(trim(seo_description), ''), 'รวมบ้านพักพูลวิลล่าพัทยา บ้านพักสระส่วนตัวสำหรับครอบครัว กลุ่มเพื่อน และทริปปาร์ตี้ เลือกทำเล จำนวนคน ห้องนอน ราคา และดูบ้านพักใกล้ทะเลได้ง่าย'),
  seo_og_image_url = coalesce(nullif(trim(seo_og_image_url), ''), '/images/BPV-66_Cover-Web.jpg'),
  seo_og_image_alt = coalesce(nullif(trim(seo_og_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา'),
  seo_business_name = coalesce(nullif(trim(seo_business_name), ''), 'Pool Villas Pattaya'),
  seo_same_as_urls = case
    when jsonb_typeof(seo_same_as_urls) = 'array' then
      case
        when jsonb_array_length(seo_same_as_urls) > 0 then seo_same_as_urls
        else '["https://www.facebook.com/baanpoolvillas","https://line.me/R/ti/p/@baanpoolvilla"]'::jsonb
      end
    else '["https://www.facebook.com/baanpoolvillas","https://line.me/R/ti/p/@baanpoolvilla"]'::jsonb
  end
where id = 'global';

notify pgrst, 'reload schema';
