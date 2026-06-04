alter table public.site_settings
  add column if not exists detail_layout jsonb not null default '{
    "version": 1,
    "lockedTop": ["gallery", "intro"],
    "rows": [
      {
        "id": "row_details_booking",
        "columns": 2,
        "ratio": "70/30",
        "enabled": true,
        "blocks": [
          { "type": "details", "title": "รายละเอียดบ้านพัก", "enabled": true, "hideWhenEmpty": true },
          { "type": "booking_contact", "title": "จอง / ติดต่อ", "enabled": true, "hideWhenEmpty": false }
        ]
      },
      {
        "id": "row_bedroom_pool",
        "columns": 2,
        "ratio": "50/50",
        "enabled": true,
        "blocks": [
          { "type": "bedrooms", "title": "รายละเอียดห้องนอน", "enabled": true, "hideWhenEmpty": true },
          { "type": "pool", "title": "สระว่ายน้ำ", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_kitchen_amenities_images",
        "columns": 3,
        "enabled": true,
        "blocks": [
          { "type": "kitchen", "title": "ครัวและอุปกรณ์", "enabled": true, "hideWhenEmpty": true },
          { "type": "amenities", "title": "สิ่งอำนวยความสะดวก", "enabled": true, "hideWhenEmpty": true },
          { "type": "categorized_images", "title": "รูปภาพตามหมวด", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_costs_rules",
        "columns": 2,
        "ratio": "70/30",
        "enabled": true,
        "blocks": [
          { "type": "costs_promotions", "title": "ค่าใช้จ่าย / โปรโมชัน", "enabled": true, "hideWhenEmpty": true },
          { "type": "rules_pet_policy", "title": "กฎบ้านพัก / สัตว์เลี้ยง", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_map_video",
        "columns": 2,
        "ratio": "60/40",
        "enabled": true,
        "blocks": [
          { "type": "map_nearby", "title": "แผนที่ / สถานที่ใกล้เคียง", "enabled": true, "hideWhenEmpty": true },
          { "type": "review_videos", "title": "คลิปรีวิว", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_recommended",
        "columns": 1,
        "enabled": true,
        "blocks": [
          { "type": "recommended_villas", "title": "บ้านพักแนะนำ", "enabled": true, "hideWhenEmpty": true }
        ]
      }
    ]
  }'::jsonb;

notify pgrst, 'reload schema';
