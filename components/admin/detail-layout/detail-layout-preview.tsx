import type { DetailLayoutConfig, DetailLayoutRow } from "./types";

interface DetailLayoutPreviewProps {
  activeRowId: string | null;
  layout: DetailLayoutConfig;
}

function getPreviewGridClass(row: DetailLayoutRow): string {
  if (row.columns === 1) {
    return "grid-cols-1";
  }

  if (row.columns === 3) {
    return "grid-cols-3";
  }

  if (row.ratio === "70/30") {
    return "grid-cols-[7fr_3fr]";
  }

  if (row.ratio === "60/40") {
    return "grid-cols-[6fr_4fr]";
  }

  if (row.ratio === "40/60") {
    return "grid-cols-[4fr_6fr]";
  }

  if (row.ratio === "30/70") {
    return "grid-cols-[3fr_7fr]";
  }

  return "grid-cols-2";
}

function getSlotIndexes(columns: DetailLayoutRow["columns"]): number[] {
  return Array.from({ length: columns }, (_, index) => index);
}

export function DetailLayoutPreview({
  activeRowId,
  layout,
}: DetailLayoutPreviewProps) {
  return (
    <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--site-text)]">
            ตัวอย่างย่อ
          </h2>
          <p className="mt-0.5 text-xs text-[var(--site-muted)]">
            โครงรวมที่ผู้เข้าชมจะเห็น
          </p>
        </div>
        <span className="rounded-full bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-muted)]">
          {layout.rows.length} แถว
        </span>
      </div>

      <div className="grid gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-2">
        <div className="h-14 rounded-md bg-[var(--site-primary)]/15 px-3 py-2 text-xs font-semibold text-[var(--site-primary)]">
          แกลเลอรี
        </div>
        <div className="h-10 rounded-md bg-[var(--site-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--site-text)]">
          ข้อมูลเริ่มต้นบ้านพัก
        </div>

        {layout.rows.map((row) => (
          <div
            className={`grid gap-1 rounded-md border p-1 ${
              row.id === activeRowId
                ? "border-[var(--site-primary)]"
                : "border-[var(--site-border)]"
            } ${row.enabled ? "opacity-100" : "opacity-50"} ${getPreviewGridClass(row)}`}
            key={row.id}
          >
            {getSlotIndexes(row.columns).map((blockIndex) => {
              const block = row.blocks[blockIndex];

              return (
                <div
                  className="min-h-8 rounded bg-[var(--site-surface)] px-2 py-1 text-[10px] font-semibold leading-4 text-[var(--site-muted)]"
                  key={`${row.id}-preview-${blockIndex}`}
                >
                  <span className="line-clamp-2">
                    {block?.title ?? "ว่าง"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
