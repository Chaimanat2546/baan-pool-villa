insert into public.home_sections (
  slug,
  title,
  description,
  display_order,
  is_active,
  mode,
  limit_count,
  cta_enabled,
  cta_label,
  cta_href,
  fallback_mode,
  slice_offset
)
values
  (
    'featured',
    'บ้านพักแนะนำ',
    'พูลวิลล่าคัดพิเศษ เหมาะสำหรับครอบครัว กลุ่มเพื่อน และทริปพักผ่อนส่วนตัว',
    0,
    true,
    'slice',
    12,
    true,
    'ดูบ้านพักทั้งหมด',
    '/search',
    'fill_from_all',
    0
  ),
  (
    'popular',
    'พูลวิลล่าพัทยายอดฮิต',
    'บ้านพักยอดนิยมสำหรับทริปพัทยา ใกล้แหล่งท่องเที่ยว เดินทางสะดวก และเหมาะกับกลุ่มเพื่อน',
    1,
    true,
    'slice',
    12,
    true,
    'ดูบ้านพักทั้งหมด',
    '/search',
    'fill_from_all',
    12
  ),
  (
    'near-sea',
    'บ้านพักใกล้ทะเล',
    'เลือกพูลวิลล่าใกล้ชายหาด เดินทางง่าย เหมาะกับคนที่อยากพักผ่อนใกล้ทะเล',
    2,
    true,
    'near_sea',
    12,
    true,
    'ดูบ้านพักใกล้ทะเล',
    '/search?nearSea=1',
    'fill_near_sea',
    0
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  mode = excluded.mode,
  limit_count = excluded.limit_count,
  cta_enabled = excluded.cta_enabled,
  cta_label = excluded.cta_label,
  cta_href = excluded.cta_href,
  fallback_mode = excluded.fallback_mode,
  slice_offset = excluded.slice_offset;
