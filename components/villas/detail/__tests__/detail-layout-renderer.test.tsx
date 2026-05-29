import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_DETAIL_LAYOUT } from "../../../../lib/detail-layout/defaults";
import type { DetailLayoutConfig } from "../../../../lib/detail-layout/types";
import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";
import type { VillaDetailContent } from "../../../../lib/villas/detail";
import type { VillaListing } from "../../../../lib/villas/types";
import { DetailLayoutRenderer } from "../detail-layout-renderer";
import type { GalleryCategory } from "../types";

const listing: VillaListing = {
  id: "66",
  zone: "pattaya",
  zoneLabel: "พัทยา",
  bedrooms: 4,
  bathrooms: 5,
  distanceToSea: "1 กม.",
  price: 12000,
  people: 12,
  coverImage: null,
  amenities: [
    { key: "wifi", label: "Wi-Fi" },
    { key: "grill", label: "เตาปิ้งย่าง" },
  ],
  poolType: "private",
};

const recommendedVilla: VillaListing = {
  ...listing,
  id: "77",
  bedrooms: 5,
  bathrooms: 6,
  people: 14,
};

const content: VillaDetailContent = {
  facts: [
    { label: "เช็คอิน", value: "14:00" },
    { label: "เช็คเอาต์", value: "12:00" },
    { label: "ค่าประกัน", value: "฿5,000" },
    { label: "เสริมคน", value: "฿500 / คน" },
  ],
  location: {
    address: "บ้านพักติดเขาพระตำหนัก",
    seaDistance: "1 กม.",
    mapUrl: "https://maps.example.com/villa-66",
  },
  nearbyPlaces: [
    {
      name: "หาดจอมเทียน",
      zone: "ทะเล",
      url: "https://maps.example.com/jomtien",
    },
  ],
  sections: [
    {
      title: "รายละเอียดเพิ่มเติม",
      lines: ["บ้านพักพร้อมพื้นที่ส่วนกลางสำหรับครอบครัว"],
    },
    {
      title: "รายละเอียดห้องนอน",
      lines: ["ชั้นล่าง 1 ห้องนอน", "ชั้นบน 3 ห้องนอน"],
    },
    {
      title: "สระว่ายน้ำ",
      lines: ["สระส่วนตัวระบบเกลือ"],
    },
    {
      title: "ครัวและอุปกรณ์",
      lines: ["มีเตาปิ้งย่างและอุปกรณ์ทำครัว"],
    },
    {
      title: "ค่าใช้จ่ายเพิ่มเติม",
      lines: ["ค่าไฟคิดตามมิเตอร์"],
    },
    {
      title: "โปรโมชัน / ราคาแยกตามวัน",
      lines: ["สอบถามราคาเสาร์และวันหยุดยาว"],
    },
    {
      title: "หมายเหตุ",
      lines: ["ราคานี้อาจเปลี่ยนตามฤดูกาล"],
    },
    {
      title: "กฎบ้านพัก",
      lines: ["งดใช้เสียงดังหลังเวลาที่กำหนด"],
    },
    {
      title: "นโยบายสัตว์เลี้ยง",
      lines: ["โปรดแจ้งสัตว์เลี้ยงก่อนเข้าพัก"],
    },
  ],
  videos: [
    {
      url: "https://youtu.be/example",
      embedUrl: "https://www.youtube.com/embed/example",
      watchUrl: "https://www.youtube.com/watch?v=example",
      label: "คลิปรีวิวบ้านพัก 1",
    },
  ],
};

const galleryCategories: GalleryCategory[] = [
  {
    key: "cover",
    label: "ภาพปก",
    items: [
      {
        key: "cover-1",
        url: "https://example.com/cover.jpg",
        caption: "ภาพปก",
        imageName: "cover.jpg",
        isCover: true,
        isMock: false,
        zone: "cover",
        zoneLabel: "ภาพปก",
        zoneKey: "cover",
      },
    ],
  },
  {
    key: "pool",
    label: "สระว่ายน้ำ",
    items: [
      {
        key: "pool-1",
        url: "https://example.com/pool.jpg",
        caption: "สระ",
        imageName: "pool.jpg",
        isCover: false,
        isMock: false,
        zone: "pool",
        zoneLabel: "สระว่ายน้ำ",
        zoneKey: "pool",
      },
    ],
  },
];

function render(layout: DetailLayoutConfig, overrides: Partial<VillaDetailContent> = {}) {
  return renderToStaticMarkup(
    <DetailLayoutRenderer
      content={{ ...content, ...overrides }}
      galleryCategories={galleryCategories}
      layout={layout}
      listing={listing}
      recommendedVillas={[recommendedVilla]}
      settings={{ ...DEFAULT_SITE_SETTINGS, detailLayout: layout }}
    />,
  );
}

describe("DetailLayoutRenderer", () => {
  it("renders the default detail layout blocks when data exists", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT);

    expect(markup).toContain("รายละเอียดเพิ่มเติม");
    expect(markup).toContain("บ้านพักพร้อมพื้นที่ส่วนกลางสำหรับครอบครัว");
    expect(markup).toContain("จองผ่าน LINE");
    expect(markup).toContain("รายละเอียดห้องนอน");
    expect(markup).toContain("สระว่ายน้ำ");
    expect(markup).toContain("บ้านพักแนะนำ");
  });

  it("hides the review video block when there are no videos", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT, { videos: [] });

    expect(markup).not.toContain("คลิปรีวิวบ้านพัก");
  });

  it("does not render booking contact when the block is disabled", () => {
    const layout: DetailLayoutConfig = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: DEFAULT_DETAIL_LAYOUT.rows.map((row) => ({
        ...row,
        blocks: row.blocks.map((block) =>
          block.type === "booking_contact"
            ? { ...block, enabled: false }
            : block,
        ),
      })),
    };

    const markup = render(layout);

    expect(markup).not.toContain("จองผ่าน LINE");
    expect(markup).toContain("รายละเอียดเพิ่มเติม");
  });

  it("ignores block types outside the public allowlist", () => {
    const layout = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          id: "private_row",
          columns: 1,
          enabled: true,
          blocks: [
            {
              type: "member_service",
              title: "Private member service",
              enabled: true,
              hideWhenEmpty: false,
            },
          ],
        },
      ],
    } as unknown as DetailLayoutConfig;

    const markup = render(layout);

    expect(markup).toBe("");
    expect(markup).not.toContain("Private member service");
    expect(markup).not.toContain("member_service");
  });
});
