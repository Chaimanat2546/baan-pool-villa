import { describe, expect, it } from "vitest";

import {
  DEFAULT_DETAIL_LAYOUT,
  DETAIL_LAYOUT_BLOCK_LABELS,
} from "../defaults";
import {
  cloneDetailLayout,
  moveDetailLayoutRow,
  normalizeDetailLayout,
  validateDetailLayout,
} from "../validation";

describe("normalizeDetailLayout", () => {
  it("returns the default V1 layout when the input is null", () => {
    const result = normalizeDetailLayout(null);

    expect(result).toEqual(DEFAULT_DETAIL_LAYOUT);
    expect(result).not.toBe(DEFAULT_DETAIL_LAYOUT);
    expect(result.rows[0]).not.toBe(DEFAULT_DETAIL_LAYOUT.rows[0]);
  });

  it("keeps valid rows and blocks", () => {
    const result = normalizeDetailLayout({
      version: 1,
      lockedTop: ["gallery", "intro"],
      rows: [
        {
          id: "custom_row",
          columns: 2,
          ratio: "60/40",
          enabled: true,
          blocks: [
            {
              type: "details",
              title: " รายละเอียดบ้านพัก ",
              enabled: true,
              hideWhenEmpty: true,
            },
            {
              type: "booking_contact",
              title: " จอง / ติดต่อ ",
              enabled: false,
              hideWhenEmpty: false,
            },
          ],
        },
      ],
    });

    expect(result.rows).toEqual([
      {
        id: "custom_row",
        columns: 2,
        ratio: "60/40",
        enabled: true,
        blocks: [
          {
            type: "details",
            title: "รายละเอียดบ้านพัก",
            enabled: true,
            hideWhenEmpty: true,
          },
          {
            type: "booking_contact",
            title: "จอง / ติดต่อ",
            enabled: true,
            hideWhenEmpty: true,
          },
        ],
      },
    ]);
  });

  it("falls back to the Thai default label for HTML-looking block titles", () => {
    const result = validateDetailLayout({
      version: 1,
      lockedTop: ["gallery", "intro"],
      rows: [
        {
          id: "safe_title",
          columns: 1,
          enabled: true,
          blocks: [
            {
              type: "details",
              title: "<img onerror=alert(1)>",
              enabled: true,
              hideWhenEmpty: true,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.layout.rows[0].blocks[0].title).toBe(
      DETAIL_LAYOUT_BLOCK_LABELS.details,
    );
  });

  it("falls back to the default layout for unknown blocks or invalid ratios", () => {
    expect(
      normalizeDetailLayout({
        version: 1,
        lockedTop: ["gallery", "intro"],
        rows: [
          {
            id: "bad",
            columns: 2,
            ratio: "80/20",
            enabled: true,
            blocks: [
              {
                type: "details",
                title: "Details",
                enabled: true,
                hideWhenEmpty: true,
              },
            ],
          },
        ],
      }),
    ).toEqual(DEFAULT_DETAIL_LAYOUT);

    expect(
      normalizeDetailLayout({
        version: 1,
        lockedTop: ["gallery", "intro"],
        rows: [
          {
            id: "bad_block",
            columns: 1,
            enabled: true,
            blocks: [
              {
                type: "member_service",
                title: "Private",
                enabled: true,
                hideWhenEmpty: true,
              },
            ],
          },
        ],
      }),
    ).toEqual(DEFAULT_DETAIL_LAYOUT);
  });
});

describe("validateDetailLayout", () => {
  it("reports rows with no blocks", () => {
    const result = validateDetailLayout({
      version: 1,
      lockedTop: ["gallery", "intro"],
      rows: [
        {
          id: "empty_blocks",
          columns: 1,
          enabled: true,
          blocks: [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.layout).toEqual(DEFAULT_DETAIL_LAYOUT);
    expect(result.layout).not.toBe(DEFAULT_DETAIL_LAYOUT);
    expect(result.errors).toContain(
      "แถวที่ 1 ต้องมี block อย่างน้อย 1 รายการ",
    );
  });

  it("reports rows with too many blocks", () => {
    const result = validateDetailLayout({
      version: 1,
      lockedTop: ["gallery", "intro"],
      rows: [
        {
          id: "too_many",
          columns: 1,
          enabled: true,
          blocks: [
            {
              type: "details",
              title: "Details",
              enabled: true,
              hideWhenEmpty: true,
            },
            {
              type: "pool",
              title: "Pool",
              enabled: true,
              hideWhenEmpty: true,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("แถวที่ 1 มี block มากกว่าจำนวนคอลัมน์");
  });

  it("clones layouts without sharing references", () => {
    const first = cloneDetailLayout(DEFAULT_DETAIL_LAYOUT);
    const second = cloneDetailLayout(DEFAULT_DETAIL_LAYOUT);

    first.rows[0].blocks[0].title = "Changed";

    expect(second.rows[0].blocks[0].title).not.toBe("Changed");
  });

  it("moves rows and preserves the selected row data", () => {
    const moved = moveDetailLayoutRow(DEFAULT_DETAIL_LAYOUT, 0, 2);

    expect(moved.rows.map((row) => row.id).slice(0, 3)).toEqual([
      "row_bedroom_pool",
      "row_kitchen_amenities_images",
      "row_details_booking",
    ]);
  });
});
