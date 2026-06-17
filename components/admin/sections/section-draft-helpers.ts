import type { HomeSectionDraft } from "@/lib/home-sections/types";

import type { AdminHomeSectionsResponse, AdminSectionDraft } from "./types";
import { normalizeAdminFallbackMode } from "./section-helpers";

let draftIdFallbackCounter = 0;

function makeDraftId() {
  const cryptoProvider = globalThis.crypto;

  if (typeof cryptoProvider?.randomUUID === "function") {
    return cryptoProvider.randomUUID();
  }

  if (typeof cryptoProvider?.getRandomValues === "function") {
    const values = new Uint32Array(4);
    cryptoProvider.getRandomValues(values);

    return `draft-${Date.now()}-${Array.from(values, (value) =>
      value.toString(16).padStart(8, "0"),
    ).join("")}`;
  }

  draftIdFallbackCounter += 1;
  return `draft-${Date.now()}-${draftIdFallbackCounter}`;
}

export function toHomeSectionDraft(
  section: AdminSectionDraft,
): HomeSectionDraft {
  return {
    slug: section.slug,
    title: section.title,
    description: section.description,
    mode: section.mode,
    limitCount: section.limitCount,
    fallbackMode: normalizeAdminFallbackMode(section.fallbackMode),
    sliceOffset: section.sliceOffset,
    isActive: section.isActive,
    ctaEnabled: section.ctaEnabled,
    ctaLabel: section.ctaEnabled ? "ดูเพิ่มเติม" : section.ctaLabel,
    ctaHref: section.ctaEnabled ? "/search" : section.ctaHref,
    items: section.items.map((item) => ({
      houseId: item.houseId,
      isActive: item.isActive ?? true,
    })),
  };
}

export function makeSectionsSnapshot(
  sections: AdminSectionDraft[],
): string {
  return JSON.stringify(sections.map(toHomeSectionDraft));
}

export function normalizeDisplayOrder(
  sections: AdminSectionDraft[],
): AdminSectionDraft[] {
  return sections.map((section, sectionIndex) => ({
    ...section,
    displayOrder: sectionIndex,
  }));
}

export function mapResponseSections(
  payload: AdminHomeSectionsResponse,
  existingSections: AdminSectionDraft[] = [],
): AdminSectionDraft[] {
  const existingDraftIdsBySlug = new Map(
    existingSections.map((section) => [section.slug, section.draftId]),
  );

  return normalizeDisplayOrder(
    payload.sections
      .map((section) => ({
        ...section,
        fallbackMode: normalizeAdminFallbackMode(section.fallbackMode),
        draftId: existingDraftIdsBySlug.get(section.slug) ?? makeDraftId(),
        items: section.items.map((item, itemIndex) => ({
          houseId: item.houseId,
          position: item.position ?? itemIndex,
          isActive: item.isActive ?? true,
        })),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder),
  );
}

export function makeNewSection(
  existingSections: AdminSectionDraft[],
): AdminSectionDraft {
  const usedSlugs = new Set(existingSections.map((section) => section.slug));
  let sectionNumber = existingSections.length + 1;
  let slug = `new-section-${sectionNumber}`;

  while (usedSlugs.has(slug)) {
    sectionNumber += 1;
    slug = `new-section-${sectionNumber}`;
  }

  return {
    draftId: makeDraftId(),
    slug,
    title: "ชุดบ้านพักใหม่",
    description: "",
    mode: "manual",
    limitCount: 6,
    fallbackMode: "fill_from_all",
    sliceOffset: 0,
    isActive: true,
    ctaEnabled: false,
    ctaLabel: "",
    ctaHref: "",
    items: [],
    displayOrder: existingSections.length,
  };
}

export function parseManualIds(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((houseId) => houseId.trim())
    .filter(Boolean)
    .map((houseId) => ({ houseId, isActive: true }));
}

export function isAbortSignalAborted(
  signal: AbortSignal | undefined,
): boolean {
  return signal ? signal.aborted : false;
}
