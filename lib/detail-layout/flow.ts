interface WideFlowRow<TBlock> {
  id: string;
  columns: 1 | 2;
  blocks: TBlock[];
}

type WideFlowGroup<TBlock> =
  | { kind: "full"; row: WideFlowRow<TBlock> }
  | {
      kind: "columns";
      rows: WideFlowRow<TBlock>[];
      leftColumn: TBlock[];
      rightColumn: TBlock[];
    };

/** Keep CMS slots stable after empty blocks are hidden; only explicit full rows break the flow. */
export function groupDetailLayoutWideRows<TBlock extends { slotIndex: number }>(
  rows: WideFlowRow<TBlock>[],
): WideFlowGroup<TBlock>[] {
  const groups: WideFlowGroup<TBlock>[] = [];
  for (const row of rows) {
    if (row.blocks.length === 0) continue;
    if (row.columns === 1) {
      groups.push({ kind: "full", row });
      continue;
    }
    let group = groups.at(-1);
    if (group?.kind !== "columns") {
      group = { kind: "columns", rows: [], leftColumn: [], rightColumn: [] };
      groups.push(group);
    }
    group.rows.push(row);
    for (const block of row.blocks) {
      (block.slotIndex === 0 ? group.leftColumn : group.rightColumn).push(block);
    }
  }
  return groups;
}
