import {
  BedDouble,
  ChevronRight,
  MapPin,
  Users,
} from "lucide-react";
import type { CSSProperties } from "react";

import { normalizeHouseId } from "@/lib/home-sections/validation";
import type { VillaListing } from "@/lib/villas/types";

import type { AdminManualPreviewResponse, AdminSectionDraft } from "./types";
import {
  getFallbackModeLabel,
  MODE_LABELS,
} from "./section-helpers";

interface SectionHomePreviewProps {
  preview: AdminManualPreviewResponse | null;
  section: AdminSectionDraft;
}

interface PreviewVillaItem {
  idLabel: string;
  imageUrl: string | null;
  key: string;
  meta: string;
  peopleLabel: string;
  priceLabel: string | null;
  title: string;
}

const MAX_PREVIEW_ITEMS = 4;

function getSafeImageUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function cssImageUrl(value: string): string {
  return `url("${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}")`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("th-TH");
}

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

function villaToPreviewItem(villa: VillaListing): PreviewVillaItem {
  return {
    idLabel: `#${villa.id}`,
    imageUrl: getSafeImageUrl(villa.coverImage),
    key: `villa-${villa.id}`,
    meta: `${villa.zoneLabel} / ${villa.bedrooms.toLocaleString("th-TH")} ห้องนอน`,
    peopleLabel: `พักได้ ${villa.people.toLocaleString("th-TH")} คน`,
    priceLabel: `${formatPrice(villa.price)} บาท`,
    title: `พูลวิลล่า ${villa.id}`,
  };
}

function manualDraftItemToPreviewItem(
  houseId: string,
  itemIndex: number,
): PreviewVillaItem {
  const normalizedId = normalizeHouseId(houseId);

  return {
    idLabel: normalizedId ? `#${normalizedId}` : houseId,
    imageUrl: null,
    key: `draft-${houseId}-${itemIndex}`,
    meta: normalizedId ? "รอเช็กบ้านจริง" : "เลขบ้านรูปแบบไม่ถูกต้อง",
    peopleLabel: "จะแสดงหลังบันทึก",
    priceLabel: null,
    title: normalizedId ? `บ้านพัก ${normalizedId}` : "ตรวจเลขบ้าน",
  };
}

function autoDraftItemToPreviewItem(
  section: AdminSectionDraft,
  itemIndex: number,
): PreviewVillaItem {
  const displayIndex = section.sliceOffset + itemIndex + 1;

  return {
    idLabel: `ลำดับ ${displayIndex.toLocaleString("th-TH")}`,
    imageUrl: null,
    key: `auto-${section.mode}-${itemIndex}`,
    meta: getAutoItemMeta(section),
    peopleLabel: "ดึงจากรายการบ้านจริง",
    priceLabel: null,
    title: `บ้านพักลำดับที่ ${displayIndex.toLocaleString("th-TH")}`,
  };
}

function getPreviewItems(
  section: AdminSectionDraft,
  preview: AdminManualPreviewResponse | null,
): PreviewVillaItem[] {
  const previewLimit = getPreviewLimit(section);

  if (section.mode === "manual") {
    if (preview && preview.valid.length > 0) {
      return preview.valid.slice(0, previewLimit).map(villaToPreviewItem);
    }

    return section.items
      .slice(0, previewLimit)
      .map((item, itemIndex) =>
        manualDraftItemToPreviewItem(item.houseId, itemIndex),
      );
  }

  return Array.from({ length: previewLimit }, (_, itemIndex) =>
    autoDraftItemToPreviewItem(section, itemIndex),
  );
}

function VillaPreviewTile({ item }: { item: PreviewVillaItem }) {
  const imageStyle: CSSProperties | undefined = item.imageUrl
    ? { backgroundImage: cssImageUrl(item.imageUrl) }
    : undefined;

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)]">
      <div
        className="relative h-20 bg-[var(--site-surface-tint)] bg-cover bg-center"
        style={imageStyle}
      >
        {item.imageUrl ? null : (
          <div className="grid h-full place-items-center px-2 text-center text-xs font-semibold leading-5 text-[var(--site-muted)]">
            {item.meta}
          </div>
        )}
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
          <span className="truncate">{item.meta}</span>
        </p>
        <p className="flex min-w-0 items-center gap-1 truncate text-xs text-[var(--site-muted)]">
          <Users aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{item.peopleLabel}</span>
        </p>
        {item.priceLabel ? (
          <p className="flex min-w-0 items-center gap-1 truncate text-xs font-semibold text-[var(--site-primary)]">
            <BedDouble aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{item.priceLabel}</span>
          </p>
        ) : null}
      </div>
    </article>
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

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] shadow-sm">
      <div className="border-b border-[var(--site-border)] bg-[var(--site-surface-soft)] px-4 py-3">
        <p className="text-xs font-semibold text-[var(--site-primary)]">
          ตัวอย่างบนหน้าแรก
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

          {section.ctaEnabled ? (
            <div className="mt-3 flex justify-end">
              <span className="inline-flex h-9 items-center gap-1 rounded-md bg-[var(--site-primary)] px-3 text-sm font-semibold text-[var(--site-on-primary)]">
                {section.ctaLabel.trim() || "ดูเพิ่มเติม"}
                <ChevronRight aria-hidden="true" className="size-4" />
              </span>
            </div>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-[var(--site-surface-soft)] px-2 py-2">
            <dt className="text-[var(--site-muted)]">วิธีเลือก</dt>
            <dd className="mt-1 truncate font-semibold text-[var(--site-text)]">
              {modeLabel}
            </dd>
          </div>
          <div className="rounded-md bg-[var(--site-surface-soft)] px-2 py-2">
            <dt className="text-[var(--site-muted)]">จำนวน</dt>
            <dd className="mt-1 font-semibold text-[var(--site-text)]">
              {section.limitCount} หลัง
            </dd>
          </div>
          <div className="rounded-md bg-[var(--site-surface-soft)] px-2 py-2">
            <dt className="text-[var(--site-muted)]">เติมบ้าน</dt>
            <dd className="mt-1 truncate font-semibold text-[var(--site-text)]">
              {getFallbackModeLabel(section.fallbackMode)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
