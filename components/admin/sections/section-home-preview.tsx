import { ChevronRight, MapPin } from "lucide-react";

import { normalizeHouseId } from "@/lib/home-sections/validation";

import type { AdminManualPreviewResponse, AdminSectionDraft } from "./types";
import { MODE_LABELS } from "./section-helpers";

interface SectionHomePreviewProps {
  preview: AdminManualPreviewResponse | null;
  section: AdminSectionDraft;
}

interface PreviewVillaItem {
  detail: string;
  idLabel: string;
  key: string;
  meta: string;
  status: string;
  title: string;
}

const MAX_PREVIEW_ITEMS = 4;

function getAutoItemMeta(section: AdminSectionDraft): string {
  return section.mode === "near_sea"
    ? "คัดจากบ้านใกล้ทะเล"
    : "คัดจากรายการบ้านทั้งหมด";
}

function getPreviewLimit(section: AdminSectionDraft): number {
  if (!Number.isInteger(section.limitCount)) {
    return MAX_PREVIEW_ITEMS;
  }

  return Math.min(MAX_PREVIEW_ITEMS, Math.max(1, section.limitCount));
}

function manualDraftItemToPreviewItem(
  houseId: string,
  itemIndex: number,
  preview: AdminManualPreviewResponse | null,
): PreviewVillaItem {
  const normalizedId = normalizeHouseId(houseId);
  const isValidated =
    normalizedId !== null && (preview?.validIds.includes(normalizedId) ?? false);
  const hasPreview = preview !== null;

  return {
    detail: "ตัวอย่างจำลอง ไม่แสดงรูป ราคา หรือรายละเอียดบ้านจริง",
    idLabel: normalizedId ? `#${normalizedId}` : houseId,
    key: `prototype-${houseId}-${itemIndex}`,
    meta: normalizedId
      ? "ตัวอย่างตำแหน่งบ้านพัก"
      : "เลขบ้านรูปแบบไม่ถูกต้อง",
    status: normalizedId
      ? isValidated
        ? "ตรวจพบเลขบ้านในระบบ"
        : hasPreview
          ? "ยังไม่พบเลขบ้านนี้"
          : "รอตรวจเลขบ้านจริง"
      : "ต้องแก้เลขบ้านก่อนบันทึก",
    title: normalizedId
      ? `บ้านพักตัวอย่าง ${itemIndex + 1}`
      : "รายการตัวอย่าง",
  };
}

function autoDraftItemToPreviewItem(
  section: AdminSectionDraft,
  itemIndex: number,
): PreviewVillaItem {
  const displayIndex = section.sliceOffset + itemIndex + 1;

  return {
    detail: "การ์ดนี้เป็นภาพจำลองของตำแหน่งบนหน้าแรก",
    idLabel: `ลำดับ ${displayIndex.toLocaleString("th-TH")}`,
    key: `auto-${section.mode}-${itemIndex}`,
    meta: getAutoItemMeta(section),
    status: "ระบบจะเลือกข้อมูลจริงตอนแสดงผลหน้าแรก",
    title: `บ้านพักตัวอย่างลำดับที่ ${displayIndex.toLocaleString("th-TH")}`,
  };
}

function getPreviewItems(
  section: AdminSectionDraft,
  preview: AdminManualPreviewResponse | null,
): PreviewVillaItem[] {
  const previewLimit = getPreviewLimit(section);

  if (section.mode === "manual") {
    return section.items
      .slice(0, previewLimit)
      .map((item, itemIndex) =>
        manualDraftItemToPreviewItem(item.houseId, itemIndex, preview),
      );
  }

  return Array.from({ length: previewLimit }, (_, itemIndex) =>
    autoDraftItemToPreviewItem(section, itemIndex),
  );
}

function VillaPreviewTile({ item }: { item: PreviewVillaItem }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      <div className="relative grid h-20 place-items-center bg-[var(--site-surface-tint)] px-3 text-center">
        <div>
          <p className="text-xs font-semibold leading-5 text-[var(--site-muted)]">
            {item.meta}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--site-muted)]">
            Prototype only
          </p>
        </div>
        <span className="absolute left-2 top-2 rounded bg-[var(--site-surface)]/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--site-text)] shadow-sm">
          {item.idLabel}
        </span>
      </div>
      <div className="grid gap-1 p-2">
        <h4 className="truncate text-sm font-semibold text-[var(--site-text)]">
          {item.title}
        </h4>
        <p className="flex min-w-0 items-center gap-1 truncate text-xs text-[var(--site-muted)]">
          <MapPin aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{item.status}</span>
        </p>
        <p className="line-clamp-2 text-xs leading-5 text-[var(--site-muted)]">
          {item.detail}
        </p>
      </div>
    </article>
  );
}

function PreviewIssueList({
  ids,
  title,
  tone,
}: {
  ids: string[];
  title: string;
  tone: "amber" | "red";
}) {
  if (ids.length === 0) {
    return null;
  }

  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1 break-words font-mono text-xs">{ids.join(", ")}</p>
    </div>
  );
}

export function SectionHomePreview({
  preview,
  section,
}: SectionHomePreviewProps) {
  const previewItems = getPreviewItems(section, preview);
  const modeLabel = MODE_LABELS.get(section.mode) ?? section.mode;
  const title = section.title.trim() || "ยังไม่ได้ตั้งชื่อชุด";
  const description =
    section.description.trim() || "คำอธิบายชุดบ้านพักจะแสดงตรงนี้";
  const missingIds = preview?.missingIds ?? [];
  const invalidIds = preview?.invalidIds ?? [];
  const hasPreviewIssues =
    section.mode === "manual" &&
    preview !== null &&
    (missingIds.length > 0 || invalidIds.length > 0);

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      <div className="border-b border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-3">
        <p className="text-xs font-semibold text-[var(--site-primary)]">
          ตัวอย่างจำลองบนหน้าแรก
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--site-muted)]">
          ไม่ดึงรูป ราคา โซน จำนวนคน หรือรายละเอียดบ้านจริงมาแสดงในหน้านี้
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-base font-semibold text-[var(--site-text)]">
            ชุดที่ {section.displayOrder + 1}
          </h3>
          <span
            className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
              section.isActive
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {section.isActive ? "เปิดอยู่" : "ปิดอยู่"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-3">
        <div className="rounded-lg border border-[var(--site-border)] bg-[var(--site-surface-soft)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--site-primary)]">
                หน้าแรก
              </p>
              <h4 className="mt-1 line-clamp-2 text-lg font-semibold leading-7 text-[var(--site-text)]">
                {title}
              </h4>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--site-muted)]">
                {description}
              </p>
            </div>
            <span className="shrink-0 rounded bg-[var(--site-primary-soft)] px-2 py-1 text-xs font-semibold text-[var(--site-primary)]">
              {modeLabel}
            </span>
          </div>

          {previewItems.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {previewItems.map((item) => (
                <VillaPreviewTile item={item} key={item.key} />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-6 text-center text-sm text-[var(--site-muted)]">
              ยังไม่มีบ้านในชุดนี้
            </div>
          )}

          {hasPreviewIssues ? (
            <div className="mt-3 grid gap-2">
              <PreviewIssueList
                ids={missingIds}
                title="เลขบ้านที่ไม่พบในระบบ"
                tone="amber"
              />
              <PreviewIssueList
                ids={invalidIds}
                title="เลขบ้านที่รูปแบบไม่ถูกต้อง"
                tone="red"
              />
            </div>
          ) : null}

          {section.ctaEnabled ? (
            <div className="mt-3 flex justify-end">
              <span className="inline-flex h-9 items-center gap-1 rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)]">
                {section.ctaLabel.trim() || "ดูเพิ่มเติม"}
                <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
