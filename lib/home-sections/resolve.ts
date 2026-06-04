import { isNearSeaVilla } from "../villas/filters";
import type { VillaListing } from "../villas/types";
import type { HomeSectionConfig, ResolvedHomeSection } from "./types";

function getLimitCount(section: HomeSectionConfig): number {
  if (!Number.isFinite(section.limitCount)) {
    return 1;
  }

  return Math.max(1, Math.trunc(section.limitCount));
}

function isInternalHref(value: string): boolean {
  const href = value.trim();

  return href.startsWith("/") && !href.startsWith("//");
}

function buildCta(section: HomeSectionConfig): ResolvedHomeSection["cta"] {
  if (!section.ctaEnabled) {
    return undefined;
  }

  const label = section.ctaLabel?.trim();
  const href = section.ctaHref?.trim();

  if (!label || !href || !isInternalHref(href)) {
    return undefined;
  }

  return { label, href };
}

function appendFallbackVillas(
  selectedVillas: VillaListing[],
  fallbackVillas: VillaListing[],
  limitCount: number,
): VillaListing[] {
  if (selectedVillas.length >= limitCount) {
    return selectedVillas.slice(0, limitCount);
  }

  const selectedIds = new Set(selectedVillas.map((villa) => villa.id));
  const resolvedVillas = [...selectedVillas];

  for (const villa of fallbackVillas) {
    if (resolvedVillas.length >= limitCount) {
      break;
    }

    if (selectedIds.has(villa.id)) {
      continue;
    }

    selectedIds.add(villa.id);
    resolvedVillas.push(villa);
  }

  return resolvedVillas;
}

function resolveManualVillas(
  section: HomeSectionConfig,
  villasById: Map<string, VillaListing>,
): VillaListing[] {
  const selectedIds = new Set<string>();
  const resolvedVillas: VillaListing[] = [];

  for (const item of [...section.items]
    .filter((sectionItem) => sectionItem.isActive)
    .sort((a, b) => a.position - b.position)) {
    if (selectedIds.has(item.houseId)) {
      continue;
    }

    const villa = villasById.get(item.houseId);

    if (!villa) {
      continue;
    }

    selectedIds.add(item.houseId);
    resolvedVillas.push(villa);
  }

  return resolvedVillas;
}

function resolveSectionVillas(
  section: HomeSectionConfig,
  villas: VillaListing[],
  villasById: Map<string, VillaListing>,
): VillaListing[] {
  const limitCount = getLimitCount(section);
  const sliceOffset = Math.max(0, section.sliceOffset);
  let selectedVillas: VillaListing[];

  switch (section.mode) {
    case "manual":
      selectedVillas = resolveManualVillas(section, villasById);
      break;
    case "near_sea":
      selectedVillas = villas.filter(isNearSeaVilla);
      break;
    case "slice":
      selectedVillas = villas.slice(sliceOffset);
      break;
  }

  selectedVillas = selectedVillas.slice(0, limitCount);

  switch (section.fallbackMode) {
    case "fill_from_all":
      return appendFallbackVillas(selectedVillas, villas, limitCount);
    case "fill_near_sea":
      return appendFallbackVillas(
        selectedVillas,
        villas.filter(isNearSeaVilla),
        limitCount,
      );
    case "none":
      return selectedVillas;
  }
}

export function resolveHomeSections(
  configs: HomeSectionConfig[],
  villas: VillaListing[],
): ResolvedHomeSection[] {
  const villasById = new Map(villas.map((villa) => [villa.id, villa]));

  return configs
    .filter((section) => section.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((section) => {
      const cta = buildCta(section);

      return {
        slug: section.slug,
        title: section.title,
        description: section.description,
        ...(cta ? { cta } : {}),
        villas: resolveSectionVillas(section, villas, villasById),
      };
    });
}

export function buildFallbackHomeSections(
  villas: VillaListing[],
): ResolvedHomeSection[] {
  const sections: ResolvedHomeSection[] = [
    {
      slug: "featured",
      title: "บ้านพักแนะนำ",
      description:
        "พูลวิลล่าคัดพิเศษ เหมาะสำหรับครอบครัว กลุ่มเพื่อน และทริปพักผ่อนส่วนตัว",
      cta: { label: "ดูบ้านพักทั้งหมด", href: "/search" },
      villas: villas.slice(0, 12),
    },
    {
      slug: "popular",
      title: "พูลวิลล่าพัทยายอดฮิต",
      description:
        "บ้านพักยอดนิยมสำหรับทริปพัทยา ใกล้แหล่งท่องเที่ยว เดินทางสะดวก และเหมาะกับกลุ่มเพื่อน",
      villas: villas.slice(12, 24),
    },
    {
      slug: "near-sea",
      title: "บ้านพักใกล้ทะเล",
      description:
        "เลือกพูลวิลล่าใกล้ชายหาด เดินทางง่าย เหมาะกับคนที่อยากพักผ่อนใกล้ทะเล",
      villas: villas.filter(isNearSeaVilla).slice(0, 12),
    },
  ];

  return sections.filter((section) => section.villas.length > 0);
}
