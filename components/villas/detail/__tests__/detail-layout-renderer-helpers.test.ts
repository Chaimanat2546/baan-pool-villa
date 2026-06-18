import { describe, expect, it } from "vitest";
import type {
  DetailLayoutBlockType,
  DetailLayoutRatio,
  DetailLayoutRow,
} from "@/lib/detail-layout/types";
import {
  appendWideRows,
  getRowGridClass,
  isLockedFullWidthRow,
  isSplitRow,
  splitV2WideColumns,
  splitWideColumns,
} from "../detail-layout-renderer-helpers";

interface LayoutBlock {
  key: string;
  type: DetailLayoutBlockType;
}

function block(key: string, type: DetailLayoutBlockType = "details"): LayoutBlock {
  return { key, type };
}

function row(columns: DetailLayoutRow["columns"], ratio?: DetailLayoutRatio): DetailLayoutRow {
  return {
    blocks: [],
    columns,
    enabled: true,
    id: "row",
    ...(ratio === undefined ? {} : { ratio }),
  };
}

describe("detail layout renderer helpers", () => {
  it("selects the grid class from visible block count and row ratio", () => {
    expect(getRowGridClass(row(2, "70/30"), 1)).toBe("lg:grid-cols-1");
    expect(getRowGridClass(row(2, "70/30"), 2)).toBe(
      "lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]",
    );
    expect(getRowGridClass(row(2), 2)).toBe("lg:grid-cols-2");
    expect(getRowGridClass(row(3, "50/50"), 3)).toBe("lg:grid-cols-3");
  });

  it("detects split rows without treating every two-column ratio as split", () => {
    const splitRow = row(2, "70/30");
    const balancedRow = row(2, "50/50");

    expect(isSplitRow(splitRow, [block("a"), block("b")])).toBe(true);
    expect(isSplitRow(row(2, "30/70"), [block("a"), block("b")])).toBe(true);
    expect(isSplitRow(splitRow, [block("a")])).toBe(false);
    expect(isSplitRow(balancedRow, [block("a"), block("b")])).toBe(false);
  });

  it("keeps recommended villas locked to a full-width row", () => {
    expect(isLockedFullWidthRow([block("a", "details")])).toBe(false);
    expect(isLockedFullWidthRow([block("a", "recommended_villas")])).toBe(true);
  });

  it("chunks v1 wide rows and balances them into columns", () => {
    const wideRows: LayoutBlock[][] = [[block("intro")]];

    appendWideRows(wideRows, [block("costs"), block("rules"), block("map")]);

    expect(wideRows.map((wideRow) => wideRow.map((item) => item.key))).toEqual([
      ["intro"],
      ["costs", "rules"],
      ["map"],
    ]);
    expect(splitWideColumns(wideRows)).toEqual({
      leftColumn: [wideRows[0][0], wideRows[1][0], wideRows[2][0]],
      rightColumn: [wideRows[1][1]],
    });
  });

  it("balances v2 wide rows into columns from their rendered blocks", () => {
    const rows = [
      { blocks: [block("details"), block("amenities")] },
      { blocks: [block("map")] },
    ];

    expect(splitV2WideColumns(rows)).toEqual({
      leftColumn: [rows[0].blocks[0], rows[1].blocks[0]],
      rightColumn: [rows[0].blocks[1]],
    });
  });
});
