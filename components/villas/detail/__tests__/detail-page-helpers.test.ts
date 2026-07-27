import { describe, expect, it } from "vitest";
import { DEFAULT_DETAIL_LAYOUT } from "@/lib/detail-layout/defaults";
import type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
} from "@/lib/detail-layout/types";
import type { VillaImage } from "@/lib/villas/types";
import {
  getServerGalleryLoadState,
  hasEnabledBookingContact,
  hasEnabledDetailLayoutBlock,
} from "../detail-page-helpers";

const image: VillaImage = {
  caption: "Pool",
  id: 1,
  imageName: "pool.jpg",
  imageUrl: "https://images.example.com/pool.jpg",
  isCover: false,
  zone: "outside",
};

function detailBlock(
  enabled: boolean,
  type: DetailLayoutBlock["type"] = "booking_contact",
): DetailLayoutBlock {
  return {
    enabled,
    hideWhenEmpty: false,
    title: "Booking",
    type,
  };
}

describe("detail page helpers", () => {
  it("maps successful server gallery data to a loaded state", () => {
    expect(getServerGalleryLoadState("9", [image], false)).toEqual({
      error: null,
      images: [image],
      status: "loaded",
      villaId: "9",
    });
  });

  it("maps an explicit server gallery failure to an error state", () => {
    expect(getServerGalleryLoadState("9", [], true)).toMatchObject({
      images: [],
      status: "error",
      villaId: "9",
    });
  });

  it("finds enabled booking contact blocks in v1 and v2 layouts only", () => {
    const v1Layout: AnyDetailLayoutConfig = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          blocks: [detailBlock(false)],
          columns: 1,
          enabled: true,
          id: "disabled-contact",
        },
      ],
    };
    const v2Layout: AnyDetailLayoutConfig = {
      lockedBottom: [detailBlock(true)],
      lockedTop: ["gallery", "intro"],
      mainSplit: {
        narrowRows: [],
        ratio: "70/30",
        wideRows: [],
      },
      version: 2,
    };

    expect(hasEnabledBookingContact(v1Layout)).toBe(false);
    expect(hasEnabledBookingContact(v2Layout)).toBe(true);
  });

  it("finds enabled advertisement blocks before loading detail ads", () => {
    const layout: AnyDetailLayoutConfig = {
      ...DEFAULT_DETAIL_LAYOUT,
      rows: [
        {
          blocks: [detailBlock(true, "advertisements")],
          columns: 1,
          enabled: true,
          id: "ads",
        },
      ],
    };

    expect(hasEnabledDetailLayoutBlock(layout, "advertisements")).toBe(true);
    expect(hasEnabledDetailLayoutBlock(layout, "map_nearby")).toBe(false);
  });
});
