import type { DetailLayoutCanvasSelection } from "./layout-canvas";
import type {
  DetailLayoutBlock,
  DetailLayoutV2Draft,
  DetailLayoutV2DraftWideRow,
} from "./types";

interface DetailLayoutPreviewProps {
  activeSelection: DetailLayoutCanvasSelection;
  layout: DetailLayoutV2Draft;
}

function getWideGridClass(row: DetailLayoutV2DraftWideRow): string {
  return row.columns === 1 ? "grid-cols-1" : "grid-cols-2";
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
    (row) => row.enabled,
  );

  const widePreview = (
    <div className="grid gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--site-primary)]">
        ฝั่ง 70
      </p>
      {enabledWideRows.map((row) => (
        <div
          className={`grid gap-1 rounded-md border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-1 ${getWideGridClass(row)}`}
          key={row.id}
        >
          {row.blocks.map((block, blockIndex) => (
            <PreviewBlock
              block={block}
              isActive={
                activeSelection?.zone === "wide" &&
                activeSelection.rowId === row.id &&
                activeSelection.blockIndex === blockIndex
              }
              key={`${row.id}-${blockIndex}`}
            />
          ))}
        </div>
      ))}
    </div>
  );

  const narrowPreview = (
    <div className="grid gap-1.5">
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
            โครงรวมที่หน้าเว็บจะแสดง
          </p>
        </div>
        <span className="rounded-full border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-primary)]">
          {layout.mainSplit.ratio}
        </span>
      </div>

      <div className="grid gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2">
        <div
          className={`grid gap-2 ${
            isWideLeft
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
