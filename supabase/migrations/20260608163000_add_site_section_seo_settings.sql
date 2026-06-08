alter table public.site_settings
  add column if not exists search_seo_title text not null default 'ค้นหาบ้านพักพูลวิลล่าพัทยา',
  add column if not exists search_seo_description text not null default 'ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ',
  add column if not exists search_seo_og_image_url text not null default '/images/BPV-66_Cover-Web.jpg',
  add column if not exists search_seo_og_image_alt text not null default 'Pool Villa บ้านพูลวิลล่า พัทยา',
  add column if not exists guides_seo_title text not null default 'บทความแนะนำบ้านพักพูลวิลล่าพัทยา',
  add column if not exists guides_seo_description text not null default 'บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว',
  add column if not exists guides_seo_og_image_url text not null default '/images/BPV-66_Cover-Web.jpg',
  add column if not exists guides_seo_og_image_alt text not null default 'Pool Villa บ้านพูลวิลล่า พัทยา';

update public.site_settings
set
  search_seo_title = coalesce(nullif(trim(search_seo_title), ''), 'ค้นหาบ้านพักพูลวิลล่าพัทยา'),
  search_seo_description = coalesce(
    nullif(trim(search_seo_description), ''),
    'ค้นหาบ้านพักพูลวิลล่าพัทยาด้วยทำเล จำนวนผู้เข้าพัก ห้องนอน ราคา สิ่งอำนวยความสะดวก รหัสบ้าน และการเรียงลำดับที่ต้องการ'
  ),
  search_seo_og_image_url = coalesce(nullif(trim(search_seo_og_image_url), ''), '/images/BPV-66_Cover-Web.jpg'),
  search_seo_og_image_alt = coalesce(nullif(trim(search_seo_og_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา'),
  guides_seo_title = coalesce(nullif(trim(guides_seo_title), ''), 'บทความแนะนำบ้านพักพูลวิลล่าพัทยา'),
  guides_seo_description = coalesce(
    nullif(trim(guides_seo_description), ''),
    'บทความแนะนำบ้านพักพูลวิลล่าพัทยา วิธีเลือกบ้านพัก และการเตรียมตัวก่อนเที่ยว'
  ),
  guides_seo_og_image_url = coalesce(nullif(trim(guides_seo_og_image_url), ''), '/images/BPV-66_Cover-Web.jpg'),
  guides_seo_og_image_alt = coalesce(nullif(trim(guides_seo_og_image_alt), ''), 'Pool Villa บ้านพูลวิลล่า พัทยา')
where id = 'global';

notify pgrst, 'reload schema';
