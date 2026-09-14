import type { DetailLayoutCanvasSelection } from "./layout-canvas";
import { groupDetailLayoutWideRows } from "@/lib/detail-layout/flow";
import type {
  DetailLayoutBlock,
  DetailLayoutV2Draft,
} from "./types";

interface DetailLayoutPreviewProps {
  activeSelection: DetailLayoutCanvasSelection;
  layout: DetailLayoutV2Draft;
}

function PreviewBlock({
  block,
  isActive,
}: {
  block: DetailLayoutBlock | null;
  isActive?: boolean;
}) {
  return (
    <div
      className={`min-h-8 rounded-md border px-2 py-1.5 text-[10px] font-semibold leading-4 ${
        isActive
          ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
          : "border-[var(--site-border)] bg-[var(--site-surface)] text-[var(--site-muted)]"
      }`}
    >
      <span className="line-clamp-2">
        {block?.title ?? "ช่องว่าง"}
      </span>
    </div>
  );
}

export function DetailLayoutPreview({
  activeSelection,
  layout,
}: DetailLayoutPreviewProps) {
  const isWideLeft = layout.mainSplit.ratio === "70/30";
  const enabledWideRows = layout.mainSplit.wideRows.filter((row) => row.enabled);
  const enabledNarrowRows = layout.mainSplit.narrowRows.filter(
    (row) => row.enabled && row.block?.enabled,
  );
  const wideGroups = groupDetailLayoutWideRows(enabledWideRows.map((row) => ({
    ...row,
    blocks: row.blocks.flatMap((block, slotIndex) => block?.enabled ? [{
      slotIndex,
      key: `${row.id}-${slotIndex}`,
      node: <PreviewBlock
        block={block}
        isActive={activeSelection?.zone === "wide" && activeSelection.rowId === row.id && activeSelection.blockIndex === slotIndex}
      />,
    }] : []),
  })));

  const widePreview = wideGroups.length === 0 ? null : (
    <div className="grid min-w-0 content-start gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--site-primary)]">
        ฝั่ง 70
      </p>
      {wideGroups.map((group) => group.kind === "full" ? (
        <div key={group.row.id} className="grid min-w-0 gap-1">
          {group.row.blocks.map((block) => <div key={block.key}>{block.node}</div>)}
        </div>
      ) : (
        <div key={group.rows.map((row) => row.id).join(" ")} className={`grid min-w-0 items-start gap-1 ${group.leftColumn.length && group.rightColumn.length ? "grid-cols-2" : "grid-cols-1"}`}>
          {[group.leftColumn, group.rightColumn].map((column, index) => column.length > 0 ? (
            <div key={index} data-detail-preview-column={index === 0 ? "left" : "right"} className="grid min-w-0 content-start gap-1">
              {column.map((block) => <div key={block.key}>{block.node}</div>)}
            </div>
          ) : null)}
        </div>
      ))}
    </div>
  );

  const narrowPreview = enabledNarrowRows.length === 0 ? null : (
    <div className="grid min-w-0 content-start gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--site-primary)]">
        ฝั่ง 30
      </p>
      {enabledNarrowRows.map((row) => (
        <PreviewBlock
          block={row.block}
          isActive={
            activeSelection?.zone === "narrow" &&
            activeSelection.rowId === row.id
          }
          key={row.id}
        />
      ))}
    </div>
  );

  return (
    <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 text-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--site-text)]">ตัวอย่างย่อ</h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
            บล็อกเรียงต่อในคอลัมน์เดิม แถว 1 ช่องเริ่มใต้ทั้งสองคอลัมน์
          </p>
        </div>
        <span className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-primary)]">
          {layout.mainSplit.ratio}
        </span>
      </div>

      <div className="grid gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2">
        <div
          className={`grid items-start gap-2 ${
            !wideGroups.length || !enabledNarrowRows.length ? "grid-cols-1" : isWideLeft
              ? "grid-cols-[minmax(0,7fr)_minmax(0,3fr)]"
              : "grid-cols-[minmax(0,3fr)_minmax(0,7fr)]"
          }`}
        >
          {isWideLeft ? (
            <>
              {widePreview}
              {narrowPreview}
            </>
          ) : (
            <>
              {narrowPreview}
              {widePreview}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
