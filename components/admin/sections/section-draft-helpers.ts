import type {
  HomePageLayoutItem,
  HomeSectionDraft,
} from "@/lib/home-sections/types";

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
    autoScrollEnabled: section.autoScrollEnabled,
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
        isNew: false,
        items: section.items.map((item, itemIndex) => ({
          houseId: item.houseId,
          position: item.position ?? itemIndex,
          isActive: item.isActive ?? true,
        })),
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder),
  );
}

export function mapResponseHomePageConfig(
  payload: AdminHomeSectionsResponse,
  existingSections: AdminSectionDraft[] = [],
) {
  return {
    layout: payload.layout,
    sections: mapResponseSections(payload, existingSections),
  };
}

export function makeHomePageConfigSnapshot(
  layout: HomePageLayoutItem[],
  sections: AdminSectionDraft[],
) {
  const sectionsBySlug = new Map(
    sections.map((section) => [section.slug, section]),
  );
  const orderedSections = layout
    .filter(
      (item): item is Extract<HomePageLayoutItem, { kind: "rail" }> =>
        item.kind === "rail",
    )
    .map((item, displayOrder) => {
      const section = sectionsBySlug.get(item.key);
      if (!section) {
        throw new Error(`Missing draft for layout rail: ${item.key}`);
      }

      return { ...section, isActive: item.enabled, displayOrder };
    });

  return {
    layout,
    sections: orderedSections.map((section) => ({
      ...toHomeSectionDraft(section),
      displayOrder: section.displayOrder,
    })),
  };
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
    autoScrollEnabled: false,
    fallbackMode: "fill_from_all",
    sliceOffset: 0,
    isActive: true,
    ctaEnabled: false,
    ctaLabel: "",
    ctaHref: "",
    items: [],
    displayOrder: existingSections.length,
    isNew: true,
  };
}

export function parseManualIds(value: string) {
  const houseIds: string[] = [];
  let currentHouseId = "";

  for (const character of value) {
    if (character === "," || character === ";" || character.trim() === "") {
      if (currentHouseId) {
        houseIds.push(currentHouseId);
        currentHouseId = "";
      }
      continue;
    }

    currentHouseId += character;
  }

  if (currentHouseId) {
    houseIds.push(currentHouseId);
  }

  return houseIds.map((houseId) => ({ houseId, isActive: true }));
}

export function isAbortSignalAborted(
  signal: AbortSignal | undefined,
): boolean {
  return signal ? signal.aborted : false;
}
