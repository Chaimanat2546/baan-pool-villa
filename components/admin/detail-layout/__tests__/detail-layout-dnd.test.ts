import { describe, expect, it } from "vitest";

import {
  getCompatibleDetailLayoutDropTargetIds,
  resolveDetailLayoutDrop,
} from "../detail-layout-dnd";

describe("resolveDetailLayoutDrop", () => {
  it("routes rows, existing blocks, and a library block only to compatible targets", () => {
    expect(resolveDetailLayoutDrop("wide-row:row_a", "wide-row:row_b")).toEqual({ kind: "moveWideRow", fromRowId: "row_a", toRowId: "row_b" });
    expect(resolveDetailLayoutDrop("narrow-row:row_a", "narrow-row:row_b")).toEqual({ kind: "moveNarrowRow", fromRowId: "row_a", toRowId: "row_b" });
    expect(resolveDetailLayoutDrop("wide-block:row_a:0", "narrow-slot:row_b")).toEqual({ kind: "moveWideToNarrow", fromRowId: "row_a", fromBlockIndex: 0, toRowId: "row_b" });
    expect(resolveDetailLayoutDrop("narrow-block:row_a", "wide-slot:row_b:1")).toEqual({ kind: "moveNarrowToWide", fromRowId: "row_a", toRowId: "row_b", toBlockIndex: 1 });
    expect(resolveDetailLayoutDrop("library:block:bedrooms", "wide-slot:row_b:1")).toEqual({ kind: "copyLibraryBlock", type: "bedrooms", zone: "wide", rowId: "row_b", blockIndex: 1 });
    expect(resolveDetailLayoutDrop("wide-row:row_a", "narrow-row:row_b")).toBeNull();
    expect(resolveDetailLayoutDrop("wide-slot:row_b:nope", "narrow-row:row_b")).toBeNull();
  });
});

describe("getCompatibleDetailLayoutDropTargetIds", () => {
  const overlappingTargets = [
    "wide-row:wide_a",
    "wide-slot:wide_a:0",
    "narrow-row:narrow_a",
    "narrow-slot:narrow_a",
  ];

  it("excludes overlapping rows when dragging an existing block", () => {
    expect(
      getCompatibleDetailLayoutDropTargetIds(
        "wide-block:wide_a:0",
        overlappingTargets,
      ),
    ).toEqual(["wide-slot:wide_a:0", "narrow-slot:narrow_a"]);
  });

  it("keeps row dragging within its own zone", () => {
    expect(
      getCompatibleDetailLayoutDropTargetIds(
        "wide-row:wide_a",
        overlappingTargets,
      ),
    ).toEqual(["wide-row:wide_a"]);
  });
});
