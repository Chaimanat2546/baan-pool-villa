import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutConfig,
  DetailLayoutOuterRatio,
  DetailLayoutRatio,
  DetailLayoutRow,
  DetailLayoutV2Config,
  DetailLayoutWideRatio,
} from "./types";

export const DETAIL_LAYOUT_ALLOWED_RATIOS: DetailLayoutRatio[] = [
  "50/50",
  "60/40",
  "70/30",
  "40/60",
  "30/70",
];

export const DETAIL_LAYOUT_OUTER_SPLIT_RATIOS: DetailLayoutOuterRatio[] = [
  "70/30",
  "30/70",
];

export const DETAIL_LAYOUT_WIDE_ROW_RATIOS: DetailLayoutWideRatio[] = [
  "50/50",
];

export const DETAIL_LAYOUT_BLOCK_LABELS: Record<DetailLayoutBlockType, string> = {
  details: "รายละเอียดบ้านพัก",
  bedrooms: "ห้องนอน",
  pool: "สระว่ายน้ำ",
  kitchen: "ห้องครัว",
  amenities: "สิ่งอำนวยความสะดวก",
  categorized_images: "รูปภาพตามหมวดหมู่",
  costs_promotions: "ค่าใช้จ่ายและโปรโมชัน",
  rules_pet_policy: "กฎและสัตว์เลี้ยง",
  map_nearby: "แผนที่และสถานที่ใกล้เคียง",
  review_videos: "รีวิวและวิดีโอ",
  booking_contact: "จอง / ติดต่อ",
  recommended_villas: "บ้านพักแนะนำ",
};

function block(type: DetailLayoutBlockType): DetailLayoutBlock {
  return {
    type,
    title: DETAIL_LAYOUT_BLOCK_LABELS[type],
    enabled: true,
    hideWhenEmpty: true,
  };
}

function row(
  id: string,
  columns: DetailLayoutRow["columns"],
  blocks: DetailLayoutBlock[],
  ratio?: DetailLayoutRatio,
): DetailLayoutRow {
  return {
    id,
    columns,
    ...(ratio === undefined ? {} : { ratio }),
    enabled: true,
    blocks,
  };
}

export const DEFAULT_DETAIL_LAYOUT: DetailLayoutConfig = {
  version: 1,
  lockedTop: ["gallery", "intro"],
  rows: [
    row(
      "row_details_booking",
      2,
      [block("details"), block("booking_contact")],
      "70/30",
    ),
    row("row_bedroom_pool", 2, [block("bedrooms"), block("pool")], "50/50"),
    row("row_kitchen_amenities_images", 3, [
      block("kitchen"),
      block("amenities"),
      block("categorized_images"),
    ]),
    row(
      "row_costs_rules",
      2,
      [block("costs_promotions"), block("rules_pet_policy")],
      "70/30",
    ),
    row(
      "row_map_video",
      2,
      [block("map_nearby"), block("review_videos")],
      "60/40",
    ),
    row("row_recommended", 1, [block("recommended_villas")]),
  ],
};

export const DEFAULT_DETAIL_LAYOUT_V2: DetailLayoutV2Config = {
  version: 2,
  lockedTop: ["gallery", "intro"],
  mainSplit: {
    ratio: "70/30",
    wideRows: [
      {
        id: "wide_details_amenities",
        columns: 2,
        ratio: "50/50",
        enabled: true,
        blocks: [block("details"), block("amenities")],
      },
      {
        id: "wide_pool_kitchen",
        columns: 2,
        ratio: "50/50",
        enabled: true,
        blocks: [block("pool"), block("kitchen")],
      },
      {
        id: "wide_bedrooms_images",
        columns: 2,
        ratio: "50/50",
        enabled: true,
        blocks: [block("bedrooms"), block("categorized_images")],
      },
      {
        id: "wide_costs_videos",
        columns: 2,
        ratio: "50/50",
        enabled: true,
        blocks: [block("costs_promotions"), block("review_videos")],
      },
    ],
    narrowRows: [
      {
        id: "narrow_booking",
        enabled: true,
        block: block("booking_contact"),
      },
      {
        id: "narrow_rules",
        enabled: true,
        block: block("rules_pet_policy"),
      },
      {
        id: "narrow_map",
        enabled: true,
        block: block("map_nearby"),
      },
    ],
  },
  lockedBottom: [block("recommended_villas")],
};
