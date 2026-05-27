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

export function validateHomeSectionDrafts(sections: HomeSectionDraft[]): string[] {
  const errors: string[] = [];
  const seenSlugs = new Set<string>();

  sections.forEach((section, sectionIndex) => {
    const sectionLabel = `Section ${sectionIndex + 1}`;
    const slug = section.slug.trim();

    if (!SLUG_PATTERN.test(slug)) {
      errors.push(`${sectionLabel} slug must be lowercase and URL-safe.`);
    }

    if (seenSlugs.has(slug)) {
      errors.push(`${sectionLabel} slug duplicates another section.`);
    } else {
      seenSlugs.add(slug);
    }

    if (!section.title.trim()) {
      errors.push(`${sectionLabel} title is required.`);
    }

    if (!section.description.trim()) {
      errors.push(`${sectionLabel} description is required.`);
    }

    if (!MODES.has(section.mode)) {
      errors.push(`${sectionLabel} mode must be manual, near_sea, or slice.`);
    }

    if (!Number.isInteger(section.limitCount) || section.limitCount < 1 || section.limitCount > 12) {
      errors.push(`${sectionLabel} limit count must be between 1 and 12.`);
    }

    if (!Number.isSafeInteger(section.sliceOffset) || section.sliceOffset < 0) {
      errors.push(`${sectionLabel} slice offset must be a safe non-negative integer.`);
    }

    if (!FALLBACK_MODES.has(section.fallbackMode)) {
      errors.push(`${sectionLabel} fallback mode must be none, fill_from_all, or fill_near_sea.`);
    }

    if (section.ctaEnabled) {
      if (!section.ctaLabel.trim()) {
        errors.push(`${sectionLabel} CTA label is required when CTA is enabled.`);
      }

      if (!isInternalHref(section.ctaHref)) {
        errors.push(`${sectionLabel} CTA link must start with a single /.`);
      }
    }

    if (section.mode === "manual") {
      const seenHouseIds = new Set<string>();

      section.items.forEach((item, itemIndex) => {
        const normalizedHouseId = normalizeHouseId(item.houseId);

        if (!normalizedHouseId) {
          errors.push(`${sectionLabel} item ${itemIndex + 1} has an invalid house ID.`);
          return;
        }

        if (seenHouseIds.has(normalizedHouseId)) {
          errors.push(`${sectionLabel} has duplicate house ID ${normalizedHouseId}.`);
        } else {
          seenHouseIds.add(normalizedHouseId);
        }
      });
    }
  });

  return errors;
}

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
      position: itemIndex,
    })),
  }));
}
