import type {
  HomeSectionDraft,
  HomeSectionFallbackMode,
  HomeSectionMode,
  HomeSectionSavePayload,
} from "./types";

const MODES = new Set<HomeSectionMode>(["manual", "near_sea", "slice"]);
const FALLBACK_MODES = new Set<HomeSectionFallbackMode>([
  "none",
  "fill_from_all",
  "fill_near_sea",
]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isInternalHref(value: string): boolean {
  const href = value.trim();

  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Normalizes a free-form house id into the numeric id format used by villa and
 * home-section data.
 *
 * @param value - The raw house id entered in the admin UI.
 * @returns The normalized numeric house id, or `null` when invalid.
 */
export function normalizeHouseId(value: string): string | null {
  const compactValue = value.trim().replace(/\s+/g, "");

  if (!compactValue) {
    return null;
  }

  const id = compactValue.replace(/^dv-?/i, "");

  if (!/^\d+$/.test(id)) {
    return null;
  }

  const numericId = Number(id);

  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    return null;
  }

  return String(numericId);
}

/**
 * Validates home-section drafts and returns admin-facing error messages for
 * invalid config.
 *
 * @param sections - The home-section drafts collected from the admin editor.
 * @returns User-facing validation error messages, or an empty array when valid.
 */
export function validateHomeSectionDrafts(sections: HomeSectionDraft[]): string[] {
  const errors: string[] = [];
  const seenSlugs = new Set<string>();

  sections.forEach((section, sectionIndex) => {
    const sectionLabel = `ชุดที่ ${sectionIndex + 1}`;
    const slug = section.slug.trim();

    if (!SLUG_PATTERN.test(slug)) {
      errors.push(
        `${sectionLabel} รหัสชุดต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข หรือขีดกลางเท่านั้น`,
      );
    }

    if (seenSlugs.has(slug)) {
      errors.push(`${sectionLabel} รหัสชุดซ้ำกับชุดอื่น`);
    } else {
      seenSlugs.add(slug);
    }

    if (!section.title.trim()) {
      errors.push(`${sectionLabel} ต้องมีชื่อชุดบ้านพัก`);
    }

    if (!section.description.trim()) {
      errors.push(`${sectionLabel} ต้องมีคำอธิบาย`);
    }

    if (!MODES.has(section.mode)) {
      errors.push(`${sectionLabel} รูปแบบการเลือกบ้านไม่ถูกต้อง`);
    }

    if (
      !Number.isSafeInteger(section.limitCount) ||
      section.limitCount < 1
    ) {
      errors.push(
        `${sectionLabel} จำนวนบ้านสูงสุดที่แสดงต้องเป็นเลขตั้งแต่ 1 ขึ้นไป`,
      );
    }

    if (!Number.isSafeInteger(section.sliceOffset) || section.sliceOffset < 0) {
      errors.push(
        `${sectionLabel} ลำดับเริ่มต้นต้องเป็นเลข 0 ขึ้นไป`,
      );
    }

    if (!FALLBACK_MODES.has(section.fallbackMode)) {
      errors.push(
        `${sectionLabel} วิธีเติมบ้านเมื่อจำนวนไม่ครบไม่ถูกต้อง`,
      );
    }

    if (section.ctaEnabled) {
      if (!section.ctaLabel.trim()) {
        errors.push(`${sectionLabel} ต้องมีข้อความบนปุ่มดูเพิ่มเติม`);
      }

      if (!isInternalHref(section.ctaHref)) {
        errors.push(
          `${sectionLabel} ลิงก์ปุ่มดูเพิ่มเติมต้องขึ้นต้นด้วย /`,
        );
      }
    }

    if (section.mode === "manual") {
      const seenHouseIds = new Set<string>();

      section.items.forEach((item, itemIndex) => {
        const normalizedHouseId = normalizeHouseId(item.houseId);

        if (!normalizedHouseId) {
          errors.push(
            `${sectionLabel} เลขบ้านลำดับที่ ${itemIndex + 1} ไม่ถูกต้อง`,
          );
          return;
        }

        if (seenHouseIds.has(normalizedHouseId)) {
          errors.push(`${sectionLabel} มีเลขบ้าน ${normalizedHouseId} ซ้ำ`);
        } else {
          seenHouseIds.add(normalizedHouseId);
        }
      });
    }
  });

  return errors;
}

/**
 * Reorders section drafts and rewrites their display order for persistence.
 *
 * @param sections - The current home-section drafts.
 * @param fromIndex - The original index of the section being moved.
 * @param toIndex - The target index for the moved section.
 * @returns The reordered drafts with normalized `displayOrder` values.
 */
export function moveHomeSectionDraft<
  Section extends HomeSectionDraft & { displayOrder?: number },
>(
  sections: Section[],
  fromIndex: number,
  toIndex: number,
): (Section & { displayOrder: number })[] {
  const movedSections = sections.map((section) => ({ ...section }));
  const hasValidMove =
    Number.isInteger(fromIndex) &&
    Number.isInteger(toIndex) &&
    fromIndex >= 0 &&
    toIndex >= 0 &&
    fromIndex < movedSections.length &&
    toIndex < movedSections.length;

  if (hasValidMove && fromIndex !== toIndex) {
    const [movedSection] = movedSections.splice(fromIndex, 1);
    movedSections.splice(toIndex, 0, movedSection);
  }

  return movedSections.map((section, sectionIndex) => ({
    ...section,
    displayOrder: sectionIndex,
  }));
}

/**
 * Normalizes home-section drafts into the payload shape expected by the save
 * API.
 *
 * @param sections - The validated home-section drafts from the admin editor.
 * @returns Normalized payloads ready for persistence.
 */
export function normalizeHomeSectionDraftsForSave(
  sections: HomeSectionDraft[],
): HomeSectionSavePayload[] {
  return sections.map((section, sectionIndex) => ({
    slug: section.slug.trim(),
    title: section.title.trim(),
    description: section.description.trim(),
    mode: section.mode,
    fallbackMode: section.fallbackMode,
    sliceOffset: section.sliceOffset,
    isActive: section.isActive,
    limitCount: section.limitCount,
    display_order: sectionIndex,
    ctaLabel: section.ctaEnabled ? section.ctaLabel.trim() : null,
    ctaHref: section.ctaEnabled ? section.ctaHref.trim() : null,
    items: section.items.map((item, itemIndex) => ({
      houseId: normalizeHouseId(item.houseId) ?? item.houseId.trim(),
      isActive: item.isActive ?? true,
      position: itemIndex,
    })),
  }));
}
