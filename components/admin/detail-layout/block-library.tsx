"use client";

import { Blocks, Plus } from "lucide-react";
import type { DragEvent } from "react";

import { DETAIL_LAYOUT_BLOCK_LABELS } from "@/lib/detail-layout/defaults";
import { DETAIL_LAYOUT_BLOCK_TYPES } from "@/lib/detail-layout/types";

import type { DetailLayoutBlockType } from "./types";

interface BlockLibraryProps {
  onAddBlock: (type: DetailLayoutBlockType) => void;
  onDragStart: (type: DetailLayoutBlockType) => void;
  targetLabel: string;
}

export function BlockLibrary({
  onAddBlock,
  onDragStart,
  targetLabel,
}: BlockLibraryProps) {
  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    type: DetailLayoutBlockType,
  ) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", type);
    onDragStart(type);
  }

  return (
    <aside className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--site-text)]">
            <Blocks aria-hidden="true" className="size-4 text-[var(--site-primary)]" />
            เพิ่มส่วนข้อมูล
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
            กดเพื่อเพิ่มในแถวที่เลือก หรือลากลงช่อง
          </p>
        </div>
        <span className="rounded-full bg-[var(--site-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--site-muted)]">
          {DETAIL_LAYOUT_BLOCK_TYPES.length} รายการ
        </span>
      </div>

      <div className="mb-3 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--site-muted)]">
        เพิ่มด้วยการกดจะลงที่:{" "}
        <span className="font-semibold text-[var(--site-text)]">
          {targetLabel}
        </span>
      </div>

      <div className="grid gap-2">
        {DETAIL_LAYOUT_BLOCK_TYPES.map((type) => (
          <button
            className="grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2.5 text-left text-sm transition hover:border-[var(--site-primary)] hover:bg-[var(--site-surface-soft)]"
            draggable
            key={type}
            onClick={() => {
              onAddBlock(type);
            }}
            onDragStart={(event) => {
              handleDragStart(event, type);
            }}
            type="button"
          >
            <span className="min-w-0 truncate font-semibold text-[var(--site-text)]">
              {DETAIL_LAYOUT_BLOCK_LABELS[type]}
            </span>
            <Plus
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--site-primary)]"
            />
          </button>
        ))}
      </div>
    </aside>
  );
}
