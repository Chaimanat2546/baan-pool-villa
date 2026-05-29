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
          { "type": "details", "enabled": true, "hideWhenEmpty": true },
          { "type": "booking_contact", "enabled": true, "hideWhenEmpty": false }
        ]
      },
      {
        "id": "row_bedroom_pool",
        "columns": 2,
        "ratio": "50/50",
        "enabled": true,
        "blocks": [
          { "type": "bedrooms", "enabled": true, "hideWhenEmpty": true },
          { "type": "pool", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_kitchen_amenities_images",
        "columns": 3,
        "enabled": true,
        "blocks": [
          { "type": "kitchen", "enabled": true, "hideWhenEmpty": true },
          { "type": "amenities", "enabled": true, "hideWhenEmpty": true },
          { "type": "categorized_images", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_costs_rules",
        "columns": 2,
        "ratio": "70/30",
        "enabled": true,
        "blocks": [
          { "type": "costs_promotions", "enabled": true, "hideWhenEmpty": true },
          { "type": "rules_pet_policy", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_map_video",
        "columns": 2,
        "ratio": "60/40",
        "enabled": true,
        "blocks": [
          { "type": "map_nearby", "enabled": true, "hideWhenEmpty": true },
          { "type": "review_videos", "enabled": true, "hideWhenEmpty": true }
        ]
      },
      {
        "id": "row_recommended",
        "columns": 1,
        "enabled": true,
        "blocks": [
          { "type": "recommended_villas", "enabled": true, "hideWhenEmpty": true }
        ]
      }
    ]
  }'::jsonb;

notify pgrst, 'reload schema';
