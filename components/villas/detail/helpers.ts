import type {
  VillaDetailContent,
  VillaDetailFact,
  VillaDetailSection,
} from "@/lib/villas/detail";
import type { VillaDetailPayload, VillaImage } from "@/lib/villas/types";
import { IMAGE_ZONE_LABELS } from "./constants";
import type { GalleryCategory, GalleryItem } from "./types";

export function getVillaTitle(id: string): string {
  return `พูลวิลล่า ${id}`;
}

export function shouldBypassImageOptimizer(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl);
    return (
      url.hostname === "s3.ap-southeast-1.amazonaws.com" &&
      url.pathname.startsWith("/poolvillas.co.ltd/")
    );
  } catch {
    return false;
  }
}

function getImageZoneLabel(zone: string | null): string {
  const trimmedZone = zone?.trim().toLowerCase();
  if (!trimmedZone) {
    return IMAGE_ZONE_LABELS.uncategorized;
  }
  return IMAGE_ZONE_LABELS[trimmedZone] ?? trimmedZone.replace(/[_-]+/g, " ");
}

function getImageZoneKey(zone: string | null): string {
  if (!zone) {
    return "uncategorized";
  }

  const zoneKey = zone.trim().toLowerCase();
  return zoneKey ? zoneKey : "uncategorized";
}

export function buildGalleryItems(
  payload: VillaDetailPayload,
  images: VillaImage[],
): GalleryItem[] {
  const seenUrls = new Set<string>();
  const items: GalleryItem[] = [];
  if (payload.listing.coverImage) {
    seenUrls.add(payload.listing.coverImage);
    items.push({
      key: `listing-cover-${payload.listing.coverImage}`,
      url: payload.listing.coverImage,
      caption: "Cover image from house listing",
      imageName: null,
      isCover: true,
      isMock: false,
      zone: "cover",
      zoneLabel: "Cover",
      zoneKey: "cover",
    });
  }
  const sortedImages = [...images].sort((a, b) => {
    if (a.isCover === b.isCover) {
      return a.id - b.id;
    }
    return a.isCover ? -1 : 1;
  });
  for (const image of sortedImages) {
    if (image.imageUrl && !seenUrls.has(image.imageUrl)) {
      seenUrls.add(image.imageUrl);
      items.push({
        key: `real-${image.id}-${image.imageUrl}`,
        url: image.imageUrl,
        caption: image.caption,
        imageName: image.imageName,
        isCover: image.isCover,
        isMock: false,
        zone: image.zone,
        zoneLabel: getImageZoneLabel(image.zone),
        zoneKey: getImageZoneKey(image.zone),
      });
    }
  }
  return items;
}

export function buildDisplayGallery(items: GalleryItem[]): GalleryItem[] {
  const [mainItem, ...restItems] = items;
  if (!mainItem) {
    return [];
  }

  return [mainItem, ...sortBentoSideItems(restItems).slice(0, 3)];
}

function sortBentoSideItems(items: GalleryItem[]): GalleryItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const priorityDiff =
        getBentoZonePriority(a.item.zoneKey) - getBentoZonePriority(b.item.zoneKey);
      return priorityDiff || a.index - b.index;
    })
    .map(({ item }) => item);
}

function getBentoZonePriority(zoneKey: string): number {
  if (zoneKey === "outside") {
    return 0;
  }
  if (zoneKey === "inside") {
    return 1;
  }
  if (zoneKey === "review") {
    return 2;
  }
  return 3;
}

export function buildGalleryCategories(items: GalleryItem[]): GalleryCategory[] {
  const categories = new Map<string, GalleryCategory>();
  for (const item of items) {
    if (!categories.has(item.zoneKey)) {
      categories.set(item.zoneKey, {
        key: item.zoneKey,
        label: item.zoneLabel,
        items: [],
      });
    }
    categories.get(item.zoneKey)?.items.push(item);
  }
  return Array.from(categories.values());
}

/**
 * Produce the display description for a gallery item.
 *
 * @param item - The gallery item whose caption and zoneKey determine the description
 * @returns The trimmed `caption` if it exists and (case-insensitively) differs from `item.zoneKey`, otherwise `"รูปบ้านพัก"`
 */
export function getGalleryItemDescription(item: GalleryItem): string {
  const caption = item.caption?.trim();
  if (caption && caption.toLowerCase() !== item.zoneKey) {
    return caption;
  }
  return "รูปบ้านพัก";
}

/**
 * Locate a section in villa detail content by its exact title.
 *
 * @param content - The villa detail content containing sections to search
 * @param title - The exact section title to match
 * @returns The matching section if found, `null` otherwise
 */
export function findSection(content: VillaDetailContent, title: string): VillaDetailSection | null {
  return content.sections.find((section) => section.title === title) ?? null;
}

export function findFact(facts: VillaDetailFact[], label: string): string | null {
  return facts.find((fact) => fact.label === label)?.value ?? null;
}
