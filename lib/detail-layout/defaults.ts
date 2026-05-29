import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
} from "./types";

export const DETAIL_LAYOUT_ALLOWED_RATIOS: DetailLayoutRatio[] = [
  "50/50",
  "60/40",
  "70/30",
  "40/60",
  "30/70",
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

function block(
  type: DetailLayoutBlockType,
  hideWhenEmpty = true,
): DetailLayoutBlock {
  return {
    type,
    title: DETAIL_LAYOUT_BLOCK_LABELS[type],
    enabled: true,
    hideWhenEmpty,
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
      [block("details"), block("booking_contact", false)],
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
