import type {
  HomeSectionFallbackMode,
  HomeSectionMode,
} from "@/lib/home-sections/types";
import { normalizeHouseId } from "@/lib/home-sections/validation";

import type { AdminManualPreviewResponse, AdminSectionDraft } from "./types";

export const MODE_OPTIONS: {
  label: string;
  summary: string;
  value: HomeSectionMode;
}[] = [
  {
    label: "เลือกบ้านเอง",
    summary: "พิมพ์เลขบ้านที่อยากโชว์",
    value: "manual",
  },
  {
    label: "บ้านใกล้ทะเล",
    summary: "เลือกจากบ้านที่อยู่ใกล้ทะเล",
    value: "near_sea",
  },
  {
    label: "บ้านจากรายการทั้งหมด",
    summary: "เลือกตามลำดับรายการบ้านพัก",
    value: "slice",
  },
];

export const MODE_LABELS = new Map(
  MODE_OPTIONS.map((mode) => [mode.value, mode.label]),
);

export function normalizeAdminFallbackMode(
  fallbackMode: HomeSectionFallbackMode,
): HomeSectionFallbackMode {
  return fallbackMode === "fill_from_all" ? "fill_from_all" : "none";
}

export function getManualIdStatus(section: AdminSectionDraft) {
  const duplicateIds: string[] = [];
  const invalidIds: string[] = [];
  const seenIds = new Set<string>();

  section.items.forEach((item) => {
    const normalizedId = normalizeHouseId(item.houseId);

    if (!normalizedId) {
      invalidIds.push(item.houseId);
      return;
    }

    if (seenIds.has(normalizedId)) {
      if (!duplicateIds.includes(normalizedId)) {
        duplicateIds.push(normalizedId);
      }
      return;
    }

    seenIds.add(normalizedId);
  });

  return {
    duplicateIds,
    invalidIds,
    normalizedCount: seenIds.size,
  };
}

export function getFallbackModeLabel(value: HomeSectionFallbackMode): string {
  return normalizeAdminFallbackMode(value) === "fill_from_all"
    ? "เติมจากบ้านทั้งหมด"
    : "ไม่เติมบ้านเพิ่ม";
}

function getFallbackSourceText(value: HomeSectionFallbackMode): string {
  return normalizeAdminFallbackMode(value) === "fill_from_all"
    ? "บ้านทั้งหมด"
    : "";
}

export function getFallbackExplanation(section: AdminSectionDraft): string {
  const limitLabel = Number.isInteger(section.limitCount)
    ? `${section.limitCount} หลัง`
    : "จำนวนที่ตั้งไว้";
  const baseText =
    section.mode === "manual" ? "บ้านที่เลือก" : "บ้านที่คัดไว้";

  if (normalizeAdminFallbackMode(section.fallbackMode) === "none") {
    return `ถ้า${baseText}ไม่ครบ ${limitLabel} จะแสดงเท่าที่หาได้`;
  }

  return `ถ้า${baseText}ไม่ครบ ${limitLabel} จะเติมจาก${getFallbackSourceText(
    section.fallbackMode,
  )}`;
}

export function getManualDisplaySummary(
  section: AdminSectionDraft,
  selectedCount: number,
  isVerified: boolean,
): string {
  if (!Number.isInteger(section.limitCount) || section.limitCount < 1) {
    return "ตรวจจำนวนบ้านที่แสดงก่อนบันทึก";
  }

  const limitCount = section.limitCount;
  const selectedText = isVerified
    ? "บ้านที่หาเจอ"
    : "เลขบ้านที่อ่านรูปแบบได้";

  if (!isVerified) {
    return `ตอนนี้อ่านเลขได้ ${selectedCount} หลัง จะเช็กบ้านจริงอีกครั้งตอนบันทึก`;
  }

  if (selectedCount >= limitCount) {
    return `จะแสดง${selectedText} ${limitCount} หลังแรก`;
  }

  const shortageCount = limitCount - selectedCount;

  if (normalizeAdminFallbackMode(section.fallbackMode) === "none") {
    return selectedCount > 0
      ? `จะแสดง${selectedText} ${selectedCount} หลัง และไม่เติมบ้านเพิ่ม`
      : "ยังไม่มีบ้านที่จะแสดง เพราะตั้งไว้ว่าไม่เติมบ้านเพิ่ม";
  }

  const sourceText = getFallbackSourceText(section.fallbackMode);

  return selectedCount > 0
    ? `จะแสดง${selectedText} ${selectedCount} หลัง และเติมอีก ${shortageCount} หลังจาก${sourceText}`
    : `ยังไม่ได้เลือกบ้านเอง จะเติม ${limitCount} หลังจาก${sourceText}`;
}

export function getSectionLabel(
  section: AdminSectionDraft,
  sectionIndex: number,
) {
  return `ชุดที่ ${sectionIndex + 1}${
    section.title.trim() ? ` "${section.title.trim()}"` : ""
  }`;
}

export function getPreviewForSection(
  section: AdminSectionDraft,
  sourcePreview: AdminManualPreviewResponse,
): AdminManualPreviewResponse {
  const validById = new Map(
    sourcePreview.valid.map((villa) => [villa.id, villa]),
  );
  const requestedIds = section.items.reduce<string[]>((ids, item) => {
    const normalizedId = normalizeHouseId(item.houseId);

    if (normalizedId && !ids.includes(normalizedId)) {
      ids.push(normalizedId);
    }

    return ids;
  }, []);

  return {
    valid: requestedIds.flatMap((houseId) => {
      const villa = validById.get(houseId);

      return villa ? [villa] : [];
    }),
    missingIds: requestedIds.filter((houseId) => !validById.has(houseId)),
    invalidIds: section.items
      .map((item) => item.houseId)
      .filter((houseId) => normalizeHouseId(houseId) === null),
  };
}
