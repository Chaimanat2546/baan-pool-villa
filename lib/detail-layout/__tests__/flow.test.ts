import { describe, expect, it } from "vitest";
import { groupDetailLayoutWideRows } from "../flow";

describe("detail layout column flow", () => {
  it("keeps surviving blocks in their CMS column and continues past missing blocks", () => {
    const groups = groupDetailLayoutWideRows([
      { id: "a", columns: 2, blocks: [{ slotIndex: 0, name: "tall gallery" }, { slotIndex: 1, name: "pool" }] },
      { id: "empty", columns: 1, blocks: [] },
      { id: "b", columns: 2, blocks: [{ slotIndex: 1, name: "videos" }] },
      { id: "c", columns: 2, blocks: [{ slotIndex: 0, name: "costs" }] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      kind: "columns",
      leftColumn: [{ name: "tall gallery" }, { name: "costs" }],
      rightColumn: [{ name: "pool" }, { name: "videos" }],
    });
  });

  it("respects an explicitly full-width CMS row as a boundary", () => {
    const groups = groupDetailLayoutWideRows([
      { id: "a", columns: 2, blocks: [{ slotIndex: 0 }] },
      { id: "full", columns: 1, blocks: [{ slotIndex: 0 }] },
      { id: "b", columns: 2, blocks: [{ slotIndex: 1 }] },
    ]);
    expect(groups.map((group) => group.kind)).toEqual(["columns", "full", "columns"]);
  });
});
