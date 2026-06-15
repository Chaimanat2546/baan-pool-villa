import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DETAIL_LAYOUT,
  DEFAULT_DETAIL_LAYOUT_V2,
  DETAIL_LAYOUT_BLOCK_LABELS,
} from "../../../../lib/detail-layout/defaults";
import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlockType,
  DetailLayoutConfig,
  DetailLayoutV2Config,
} from "../../../../lib/detail-layout/types";
import { DEFAULT_SITE_SETTINGS } from "../../../../lib/site-settings/defaults";
import type { VillaDetailContent } from "../../../../lib/villas/detail";
import type {
  RecommendedVillaSection,
  VillaListing,
} from "../../../../lib/villas/types";
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

const recommendedSection: RecommendedVillaSection = {
  cta: { href: "/search?featured=1", label: "See featured villas" },
  description: "First homepage section",
  title: "Homepage featured",
  villas: [recommendedVilla],
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
      embedUrl: "https://www.youtube-nocookie.com/embed/example",
      thumbnailUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg",
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

function block(type: DetailLayoutBlockType, hideWhenEmpty = true) {
  return {
    type,
    title: DETAIL_LAYOUT_BLOCK_LABELS[type],
    enabled: true,
    hideWhenEmpty,
  };
}

function render(
  layout: AnyDetailLayoutConfig,
  overrides: Partial<VillaDetailContent> = {},
  options: { listing?: VillaListing } = {},
) {
  const activeListing = options.listing ?? listing;

  return renderToStaticMarkup(
    <DetailLayoutRenderer
      content={{ ...content, ...overrides }}
      galleryCategories={galleryCategories}
      layout={layout}
      listing={activeListing}
      recommendedSection={recommendedSection}
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
    expect(markup).toContain("Homepage featured");
  });

  it("renders recommended villa section title as h2 and villa names as h3", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT);

    expect(markup).toContain("Homepage featured</h2>");
    expect(markup).toContain("77</h3>");
  });

  it("renders detail recommendations as a full-bleed homepage rail", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT);

    expect(markup).toContain('data-detail-recommended-villas="home-rail"');
    expect(markup).toContain("relative left-1/2 w-screen -translate-x-1/2");
    expect(markup).toContain("mx-auto w-full max-w-7xl px-4 py-8");
  });

  it("hides the review video block when there are no videos", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT, { videos: [] });

    expect(markup).not.toContain("คลิปรีวิวบ้านพัก");
  });

  it("renders review videos without loading third-party iframes before play", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT);

    expect(markup).toContain("https://youtu.be/example");
    expect(markup).toContain("i.ytimg.com%2Fvi%2Fexample%2Fhqdefault.jpg");
    expect(markup).not.toContain("<iframe");
    expect(markup).not.toContain("youtube.com/embed");
    expect(markup).not.toContain("youtube-nocookie.com/embed");
  });

  it("renders long text blocks as compact expandable previews", () => {
    const detailTitle = content.sections[0]?.title ?? "";
    const longLines = Array.from(
      { length: 8 },
      (_, index) => `long detail line ${index + 1}`,
    );
    const sections = content.sections.map((section) =>
      section.title === detailTitle ? { ...section, lines: longLines } : section,
    );

    const markup = render(DEFAULT_DETAIL_LAYOUT, { sections });

    expect(markup).toContain('data-detail-compact-list="true"');
    expect(markup).toContain("<summary");
    expect(markup).toContain("long detail line 1");
    expect(markup).toContain("long detail line 8");
  });

  it("keeps split items aligned to their content height", () => {
    const markup = render(DEFAULT_DETAIL_LAYOUT);

    expect(markup).toContain('data-detail-layout-split="row_details_booking"');
    expect(markup).toContain("items-start");
  });

  it("renders long amenity lists as compact expandable previews", () => {
    const amenities = Array.from({ length: 16 }, (_, index) => ({
      key: `amenity-${index + 1}`,
      label: `Amenity ${index + 1}`,
    }));

    const markup = render(
      DEFAULT_DETAIL_LAYOUT,
      {},
      { listing: { ...listing, amenities } },
    );

    expect(markup).toContain('data-detail-amenities-compact="true"');
    expect(markup).toContain("Amenity 1");
    expect(markup).toContain("Amenity 16");
  });

  it("compacts grouped price details before they dominate a row", () => {
    const costTitle = content.sections[4]?.title ?? "";
    const costLines = Array.from(
      { length: 4 },
      (_, index) => `cost line ${index + 1}`,
    );
    const sections = content.sections.map((section) =>
      section.title === costTitle ? { ...section, lines: costLines } : section,
    );

    const markup = render(DEFAULT_DETAIL_LAYOUT, { sections });

    expect(markup).toContain('data-detail-compact-list="true"');
    expect(markup).toContain("cost line 1");
    expect(markup).toContain("cost line 4");
  });

  it("stacks 70-side row pairs into two desktop columns inside a split section", () => {
    const layout: DetailLayoutConfig = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          id: "split_booking",
          columns: 2,
          enabled: true,
          ratio: "70/30",
          blocks: [block("details"), block("booking_contact", false)],
        },
        {
          id: "wide_pair_a",
          columns: 2,
          enabled: true,
          blocks: [block("bedrooms"), block("pool")],
        },
        {
          id: "wide_pair_b",
          columns: 2,
          enabled: true,
          blocks: [block("kitchen"), block("amenities")],
        },
        {
          id: "full_recommended",
          columns: 1,
          enabled: true,
          blocks: [block("recommended_villas")],
        },
      ],
    };

    const markup = render(layout);
    const leftColumnIndex = markup.indexOf(
      'data-detail-layout-wide-column="left"',
    );
    const rightColumnIndex = markup.indexOf(
      'data-detail-layout-wide-column="right"',
    );
    const detailsIndex = markup.indexOf(
      'data-detail-layout-block="details"',
      leftColumnIndex,
    );
    const bedroomsIndex = markup.indexOf(
      'data-detail-layout-block="bedrooms"',
      leftColumnIndex,
    );
    const kitchenIndex = markup.indexOf(
      'data-detail-layout-block="kitchen"',
      leftColumnIndex,
    );
    const poolIndex = markup.indexOf(
      'data-detail-layout-block="pool"',
      rightColumnIndex,
    );
    const amenitiesIndex = markup.indexOf(
      'data-detail-layout-block="amenities"',
      rightColumnIndex,
    );

    expect(markup).toContain('data-detail-layout-split="split_booking"');
    expect(leftColumnIndex).toBeGreaterThan(-1);
    expect(rightColumnIndex).toBeGreaterThan(leftColumnIndex);
    expect(detailsIndex).toBeGreaterThan(leftColumnIndex);
    expect(bedroomsIndex).toBeGreaterThan(detailsIndex);
    expect(kitchenIndex).toBeGreaterThan(bedroomsIndex);
    expect(poolIndex).toBeGreaterThan(rightColumnIndex);
    expect(amenitiesIndex).toBeGreaterThan(poolIndex);
    expect(markup).toContain('data-detail-layout-area="narrow"');
    expect(markup).toContain('data-detail-layout-block="booking_contact"');
    expect(markup).toContain('data-detail-layout-row="full_recommended"');
  });

  it("supports swapped 30/70 split sections", () => {
    const layout: DetailLayoutConfig = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          id: "split_left_sidebar",
          columns: 2,
          enabled: true,
          ratio: "30/70",
          blocks: [block("booking_contact", false), block("details")],
        },
        {
          id: "wide_pair",
          columns: 2,
          enabled: true,
          blocks: [block("bedrooms"), block("pool")],
        },
      ],
    };

    const markup = render(layout);
    const splitIndex = markup.indexOf(
      'data-detail-layout-split="split_left_sidebar"',
    );
    const narrowIndex = markup.indexOf(
      'data-detail-layout-area="narrow"',
      splitIndex,
    );
    const wideIndex = markup.indexOf('data-detail-layout-area="wide"', splitIndex);

    expect(markup).toContain(
      "lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]",
    );
    expect(narrowIndex).toBeGreaterThan(splitIndex);
    expect(wideIndex).toBeGreaterThan(narrowIndex);
    expect(markup).toContain('data-detail-layout-block="booking_contact"');
    expect(markup).toContain('data-detail-layout-block="details"');
  });

  it("keeps recommended villas locked as a full-width section outside splits", () => {
    const layout: DetailLayoutConfig = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          id: "split_booking",
          columns: 2,
          enabled: true,
          ratio: "70/30",
          blocks: [block("details"), block("booking_contact", false)],
        },
        {
          id: "wide_pair",
          columns: 2,
          enabled: true,
          blocks: [block("bedrooms"), block("pool")],
        },
        {
          id: "locked_recommended",
          columns: 2,
          enabled: true,
          ratio: "50/50",
          blocks: [block("recommended_villas")],
        },
      ],
    };

    const markup = render(layout);
    const recommendedRowIndex = markup.indexOf(
      'data-detail-layout-row="locked_recommended"',
    );
    const splitIndex = markup.indexOf('data-detail-layout-split="split_booking"');
    const recommendedBlockIndex = markup.indexOf(
      'data-detail-layout-block="recommended_villas"',
    );

    expect(splitIndex).toBeGreaterThan(-1);
    expect(recommendedRowIndex).toBeGreaterThan(splitIndex);
    expect(recommendedBlockIndex).toBeGreaterThan(recommendedRowIndex);
    expect(markup).toContain("lg:grid-cols-1");
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

  it("ignores inherited object prototype block types", () => {
    const layout = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          id: "prototype_row",
          columns: 1,
          enabled: true,
          blocks: [
            {
              type: "toString",
              title: "Prototype renderer",
              enabled: true,
              hideWhenEmpty: false,
            },
          ],
        },
      ],
    } as unknown as DetailLayoutConfig;

    const markup = render(layout);

    expect(markup).toBe("");
    expect(markup).not.toContain("Prototype renderer");
    expect(markup).not.toContain("[object Object]");
  });

  it("renders V2 70/30 split with wide, narrow, and locked bottom areas", () => {
    const layout: DetailLayoutV2Config = {
      ...DEFAULT_DETAIL_LAYOUT_V2,
      mainSplit: {
        ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
        ratio: "70/30",
        wideRows: [
          {
            id: "wide_a",
            columns: 2,
            enabled: true,
            ratio: "60/40",
            blocks: [block("details"), block("amenities")],
          },
          {
            id: "wide_b",
            columns: 1,
            enabled: true,
            blocks: [block("bedrooms")],
          },
        ],
        narrowRows: [
          {
            id: "narrow_booking",
            enabled: true,
            block: block("booking_contact", false),
          },
        ],
      },
      lockedBottom: [block("recommended_villas")],
    };

    const markup = render(layout);

    expect(markup).toContain('data-detail-layout-split="mainSplit"');
    expect(markup).toContain('data-detail-layout-split-ratio="70/30"');
    expect(markup).toContain('data-detail-layout-wide-ratio="60/40"');
    expect(markup).toContain('data-detail-layout-area="narrow"');
    expect(markup).toContain('data-detail-layout-area="lockedBottom"');
    expect(markup).toContain('data-detail-layout-block="recommended_villas"');
  });

  it("renders V2 swapped 30/70 with the narrow area before the wide area", () => {
    const layout: DetailLayoutV2Config = {
      ...DEFAULT_DETAIL_LAYOUT_V2,
      mainSplit: {
        ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
        ratio: "30/70",
      },
    };

    const markup = render(layout);
    const splitIndex = markup.indexOf('data-detail-layout-split="mainSplit"');
    const narrowIndex = markup.indexOf(
      'data-detail-layout-area="narrow"',
      splitIndex,
    );
    const wideIndex = markup.indexOf(
      'data-detail-layout-area="wide"',
      splitIndex,
    );

    expect(markup).toContain('data-detail-layout-split-ratio="30/70"');
    expect(narrowIndex).toBeGreaterThan(splitIndex);
    expect(wideIndex).toBeGreaterThan(narrowIndex);
  });
});
