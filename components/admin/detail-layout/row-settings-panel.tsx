"use client";

import { SlidersHorizontal, Trash2 } from "lucide-react";

import { DETAIL_LAYOUT_ALLOWED_RATIOS } from "@/lib/detail-layout/defaults";

import type {
  DetailLayoutBlock,
  DetailLayoutColumns,
  DetailLayoutDraftRow,
  DetailLayoutRatio,
} from "./types";

interface RowSettingsPanelProps {
  activeBlockIndex: number | null;
  row: DetailLayoutDraftRow | null;
  onRemoveBlock: (blockIndex: number) => void;
  onSelectBlock: (blockIndex: number) => void;
  onUpdateBlock: (
    blockIndex: number,
    changes: Partial<Omit<DetailLayoutBlock, "type">>,
  ) => void;
  onUpdateColumns: (
    columns: DetailLayoutColumns,
    ratio?: DetailLayoutRatio,
  ) => void;
  onUpdateRow: (
    changes: Partial<Pick<DetailLayoutDraftRow, "enabled" | "ratio">>,
  ) => void;
}

function toColumns(value: string): DetailLayoutColumns {
  if (value === "1" || value === "2" || value === "3") {
    return Number(value) as DetailLayoutColumns;
  }

  return 1;
}

function toRatio(value: string): DetailLayoutRatio {
  return DETAIL_LAYOUT_ALLOWED_RATIOS.includes(value as DetailLayoutRatio)
    ? (value as DetailLayoutRatio)
    : "50/50";
}

interface RowLayoutHint {
  description: string;
  title: string;
}

function hasRecommendedVillasBlock(row: DetailLayoutDraftRow): boolean {
  return row.blocks.some((block) => block?.type === "recommended_villas");
}

function getRowLayoutHint(row: DetailLayoutDraftRow): RowLayoutHint | null {
  if (hasRecommendedVillasBlock(row)) {
    return {
      title: "ล็อกเต็มความกว้าง",
      description:
        "บ้านพักแนะนำจะแสดงเป็น section ยาวเต็มแถวเหมือน Gallery และข้อมูลบ้าน/ราคา",
    };
  }

  if (row.columns !== 2) {
    return null;
  }

  if (row.ratio === "70/30") {
    return {
      title: "Split 70/30",
      description:
        "ฝั่ง 70 อยู่ซ้ายและจัดเป็น 2 คอลัมน์แบบ stack / ฝั่ง 30 อยู่ขวาและเรียงแนวตั้งทีละ block",
    };
  }

  if (row.ratio === "30/70") {
    return {
      title: "Split 30/70",
      description:
        "ฝั่ง 30 อยู่ซ้ายและเรียงแนวตั้งทีละ block / ฝั่ง 70 อยู่ขวาและจัดเป็น 2 คอลัมน์แบบ stack",
    };
  }

  return null;
}

export function RowSettingsPanel({
  activeBlockIndex,
  row,
  onRemoveBlock,
  onSelectBlock,
  onUpdateBlock,
  onUpdateColumns,
  onUpdateRow,
}: RowSettingsPanelProps) {
  const activeBlock =
    row && activeBlockIndex !== null ? row.blocks[activeBlockIndex] : undefined;

  if (!row) {
    return (
      <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
          <SlidersHorizontal
            aria-hidden="true"
            className="size-4 text-[var(--site-primary)]"
          />
          ตั้งค่าแถว
        </h2>
        <p className="mt-3 rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-5 text-sm leading-6 text-[var(--site-muted)]">
          เลือกแถวในผังเพื่อแก้จำนวนคอลัมน์ สัดส่วน และ block
        </p>
      </section>
    );
  }

  const rowLayoutHint = getRowLayoutHint(row);

  return (
    <section className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
        <SlidersHorizontal
          aria-hidden="true"
          className="size-4 text-[var(--site-primary)]"
        />
        ตั้งค่าแถว
      </h2>

      <div className="mt-4 grid gap-4">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--site-text)]">
          เปิดใช้แถว
          <input
            checked={row.enabled}
            className="size-4 accent-[var(--site-primary)]"
            onChange={(event) => {
              onUpdateRow({ enabled: event.target.checked });
            }}
            type="checkbox"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[var(--site-text)]">
          จำนวนคอลัมน์
          <select
            className="h-10 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
            onChange={(event) => {
              const columns = toColumns(event.target.value);
              onUpdateColumns(columns, columns === 2 ? row.ratio : undefined);
            }}
            value={row.columns}
          >
            <option value={1}>1 คอลัมน์</option>
            <option value={2}>2 คอลัมน์</option>
            <option value={3}>3 คอลัมน์</option>
          </select>
        </label>

        {row.columns === 2 ? (
          <label className="grid gap-2 text-sm font-semibold text-[var(--site-text)]">
            สัดส่วนคอลัมน์
            <select
              className="h-10 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
              onChange={(event) => {
                onUpdateColumns(row.columns, toRatio(event.target.value));
              }}
              value={row.ratio ?? "50/50"}
            >
              {DETAIL_LAYOUT_ALLOWED_RATIOS.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {rowLayoutHint ? (
          <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-sm leading-6">
            <p className="font-semibold text-[var(--site-text)]">
              {rowLayoutHint.title}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
              {rowLayoutHint.description}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-[var(--site-text)]">
            Block ในแถว
          </p>
          {row.blocks.every((block) => block === null) ? (
            <p className="rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-4 text-sm text-[var(--site-muted)]">
              แถวนี้ยังไม่มี block ลากจากคลังหรือกดเพิ่มจากด้านซ้าย
            </p>
          ) : (
            row.blocks.map((block, blockIndex) => {
              const isActive = blockIndex === activeBlockIndex;

              return (
                <button
                  aria-pressed={isActive}
                  className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "border-[var(--site-primary)] bg-[var(--site-primary-soft)]"
                      : "border-[var(--site-border)] bg-[var(--site-surface-soft)] hover:bg-[var(--site-surface)]"
                  }`}
                  key={`${row.id}-${blockIndex}`}
                  onClick={() => {
                    onSelectBlock(blockIndex);
                  }}
                  type="button"
                >
                  <span className="min-w-0 truncate font-semibold text-[var(--site-text)]">
                    {blockIndex + 1}. {block?.title ?? "ช่องว่าง"}
                  </span>
                  <span className="text-xs font-semibold text-[var(--site-muted)]">
                    {block ? (block.enabled ? "เปิด" : "ปิด") : "ว่าง"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {activeBlock === null && activeBlockIndex !== null ? (
          <p className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-3 text-sm leading-6 text-[var(--site-muted)]">
            กำลังเลือกช่องว่างที่ {activeBlockIndex + 1} เพิ่ม block
            จากคลังด้านซ้ายหรือปรับจำนวนคอลัมน์ของแถวนี้
          </p>
        ) : null}

        {activeBlock && activeBlockIndex !== null ? (
          <div className="grid gap-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
            <label className="grid gap-2 text-sm font-semibold text-[var(--site-text)]">
              ชื่อที่แสดง
              <input
                className="h-10 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
                onChange={(event) => {
                  onUpdateBlock(activeBlockIndex, {
                    title: event.target.value,
                  });
                }}
                value={activeBlock.title}
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--site-text)]">
              เปิดใช้ block
              <input
                checked={activeBlock.enabled}
                className="size-4 accent-[var(--site-primary)]"
                onChange={(event) => {
                  onUpdateBlock(activeBlockIndex, {
                    enabled: event.target.checked,
                  });
                }}
                type="checkbox"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--site-text)]">
              ซ่อนเมื่อไม่มีข้อมูล
              <input
                checked={activeBlock.hideWhenEmpty}
                className="size-4 accent-[var(--site-primary)]"
                onChange={(event) => {
                  onUpdateBlock(activeBlockIndex, {
                    hideWhenEmpty: event.target.checked,
                  });
                }}
                type="checkbox"
              />
            </label>

            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-200 bg-[var(--site-surface)] px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              onClick={() => {
                onRemoveBlock(activeBlockIndex);
              }}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              ลบ block
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
