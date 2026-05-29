import { describe, expect, it } from "vitest";

import { DEFAULT_DETAIL_LAYOUT, DEFAULT_DETAIL_LAYOUT_V2 } from "../defaults";
import {
  cloneDetailLayoutV2,
  convertDetailLayoutV1ToV2,
  normalizeDetailLayoutV2,
  validateDetailLayoutV2,
} from "../version-2";

describe("DEFAULT_DETAIL_LAYOUT_V2", () => {
  it("uses locked top, a 70/30 split, wide rows, narrow rows, and locked recommended villas", () => {
    expect(DEFAULT_DETAIL_LAYOUT_V2.version).toBe(2);
    expect(DEFAULT_DETAIL_LAYOUT_V2.lockedTop).toEqual(["gallery", "intro"]);
    expect(DEFAULT_DETAIL_LAYOUT_V2.mainSplit.ratio).toBe("70/30");
    expect(DEFAULT_DETAIL_LAYOUT_V2.mainSplit.wideRows[0]).toMatchObject({
      columns: 2,
      ratio: "60/40",
    });
    expect(DEFAULT_DETAIL_LAYOUT_V2.mainSplit.narrowRows[0].block.type).toBe(
      "booking_contact",
    );
    expect(DEFAULT_DETAIL_LAYOUT_V2.lockedBottom[0].type).toBe(
      "recommended_villas",
    );
  });
});

describe("convertDetailLayoutV1ToV2", () => {
  it("moves the split wide block to wideRows and the side block to narrowRows", () => {
    const result = convertDetailLayoutV1ToV2(DEFAULT_DETAIL_LAYOUT);

    expect(result.version).toBe(2);
    expect(result.mainSplit.ratio).toBe("70/30");
    expect(result.mainSplit.wideRows[0].blocks[0].type).toBe("details");
    expect(result.mainSplit.narrowRows[0].block.type).toBe("booking_contact");
    expect(
      result.mainSplit.wideRows.some((row) =>
        row.blocks.some((block) => block.type === "bedrooms"),
      ),
    ).toBe(true);
    expect(result.lockedBottom[0].type).toBe("recommended_villas");
  });
});

describe("validateDetailLayoutV2", () => {
  it("accepts a valid V2 layout without sharing references", () => {
    const result = validateDetailLayoutV2(DEFAULT_DETAIL_LAYOUT_V2);

    expect(result.ok).toBe(true);
    expect(result.layout).toEqual(DEFAULT_DETAIL_LAYOUT_V2);
    expect(result.layout).not.toBe(DEFAULT_DETAIL_LAYOUT_V2);
  });

  it("rejects invalid outer split ratios", () => {
    const result = validateDetailLayoutV2({
      ...DEFAULT_DETAIL_LAYOUT_V2,
      mainSplit: {
        ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
        ratio: "50/50",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "สัดส่วนโซนหลักต้องเป็น 70/30 หรือ 30/70",
    );
  });

  it("rejects 70/30 as a wide-row internal ratio", () => {
    const result = validateDetailLayoutV2({
      ...DEFAULT_DETAIL_LAYOUT_V2,
      mainSplit: {
        ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
        wideRows: [
          {
            id: "bad_wide_ratio",
            columns: 2,
            ratio: "70/30",
            enabled: true,
            blocks: [DEFAULT_DETAIL_LAYOUT_V2.mainSplit.wideRows[0].blocks[0]],
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "แถวฝั่ง 70 ที่ 1 ต้องใช้สัดส่วน 50/50, 60/40 หรือ 40/60",
    );
  });

  it("rejects narrow rows with missing or invalid single blocks", () => {
    const result = validateDetailLayoutV2({
      ...DEFAULT_DETAIL_LAYOUT_V2,
      mainSplit: {
        ...DEFAULT_DETAIL_LAYOUT_V2.mainSplit,
        narrowRows: [
          {
            id: "bad_narrow",
            enabled: true,
            block: {
              type: "member_service",
              title: "Private",
              enabled: true,
              hideWhenEmpty: true,
            },
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("แถวฝั่ง 30 ที่ 1 มี block ที่ไม่รองรับ");
  });
});

describe("normalizeDetailLayoutV2", () => {
  it("converts valid V1 layouts and falls back for invalid input", () => {
    expect(normalizeDetailLayoutV2(DEFAULT_DETAIL_LAYOUT).version).toBe(2);
    expect(normalizeDetailLayoutV2(null)).toEqual(DEFAULT_DETAIL_LAYOUT_V2);
  });
});

describe("cloneDetailLayoutV2", () => {
  it("clones nested rows and blocks", () => {
    const first = cloneDetailLayoutV2(DEFAULT_DETAIL_LAYOUT_V2);
    const second = cloneDetailLayoutV2(DEFAULT_DETAIL_LAYOUT_V2);

    first.mainSplit.wideRows[0].blocks[0].title = "Changed";
    first.mainSplit.narrowRows[0].block.title = "Changed";

    expect(second.mainSplit.wideRows[0].blocks[0].title).not.toBe("Changed");
    expect(second.mainSplit.narrowRows[0].block.title).not.toBe("Changed");
  });
});
