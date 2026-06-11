alter table public.site_settings
  add column if not exists seo_keywords jsonb not null default '["บ้านพักพูลวิลล่า","พูลวิลล่าพัทยา","บ้านพูลวิลล่าพัทยา","บ้านพักพูลวิลล่าพัทยา","บ้านพักสระส่วนตัว","พูลวิลล่าใกล้ทะเล","บ้านพักพัทยา","พูลวิลล่าจอมเทียน","พูลวิลล่าบางแสน","พูลวิลล่าหัวหิน"]'::jsonb,
  add column if not exists search_seo_keywords jsonb not null default '["ค้นหาพูลวิลล่าพัทยา","ค้นหาบ้านพักพูลวิลล่า","บ้านพักพูลวิลล่าตามราคา","พูลวิลล่าตามจำนวนคน","พูลวิลล่าตามทำเล"]'::jsonb,
  add column if not exists guides_seo_keywords jsonb not null default '["บทความพูลวิลล่าพัทยา","คู่มือเลือกพูลวิลล่า","แนะนำบ้านพักพูลวิลล่า","เที่ยวพัทยาพักพูลวิลล่า"]'::jsonb,
  add column if not exists villa_detail_seo_keywords jsonb not null default '["รายละเอียดพูลวิลล่าพัทยา","จองพูลวิลล่าพัทยา","บ้านพักพูลวิลล่ารายหลัง","พูลวิลล่าสระส่วนตัว"]'::jsonb;

update public.site_settings
set
  seo_keywords = case
    when jsonb_typeof(seo_keywords) = 'array' and jsonb_array_length(seo_keywords) > 0
      then seo_keywords
    else '["บ้านพักพูลวิลล่า","พูลวิลล่าพัทยา","บ้านพูลวิลล่าพัทยา","บ้านพักพูลวิลล่าพัทยา","บ้านพักสระส่วนตัว","พูลวิลล่าใกล้ทะเล","บ้านพักพัทยา","พูลวิลล่าจอมเทียน","พูลวิลล่าบางแสน","พูลวิลล่าหัวหิน"]'::jsonb
  end,
  search_seo_keywords = case
    when jsonb_typeof(search_seo_keywords) = 'array'
      then search_seo_keywords
    else '["ค้นหาพูลวิลล่าพัทยา","ค้นหาบ้านพักพูลวิลล่า","บ้านพักพูลวิลล่าตามราคา","พูลวิลล่าตามจำนวนคน","พูลวิลล่าตามทำเล"]'::jsonb
  end,
  guides_seo_keywords = case
    when jsonb_typeof(guides_seo_keywords) = 'array'
      then guides_seo_keywords
    else '["บทความพูลวิลล่าพัทยา","คู่มือเลือกพูลวิลล่า","แนะนำบ้านพักพูลวิลล่า","เที่ยวพัทยาพักพูลวิลล่า"]'::jsonb
  end,
  villa_detail_seo_keywords = case
    when jsonb_typeof(villa_detail_seo_keywords) = 'array'
      then villa_detail_seo_keywords
    else '["รายละเอียดพูลวิลล่าพัทยา","จองพูลวิลล่าพัทยา","บ้านพักพูลวิลล่ารายหลัง","พูลวิลล่าสระส่วนตัว"]'::jsonb
  end
where id is not null;

notify pgrst, 'reload schema';
