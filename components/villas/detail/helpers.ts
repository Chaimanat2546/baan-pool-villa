import type {
  VillaDetailContent,
  VillaDetailFact,
  VillaDetailSection,
} from "@/lib/villas/detail";
import type { PublicVillaImage } from "@/lib/villas/public-dto";
import { IMAGE_ZONE_LABELS } from "./constants";
import type { GalleryCategory, GalleryItem } from "./types";

export function getVillaTitle(id: string, title?: string): string {
  return title?.trim() || `พูลวิลล่า ${id}`;
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
  if (zoneKey === "living_room") {
    return "livingroom";
  }
  return zoneKey ? zoneKey : "uncategorized";
}

function isCoverZone(zone: string | null): boolean {
  const zoneKey = zone?.trim().toLowerCase();

  return zoneKey === "cover" || zoneKey === "รูปปก" || zoneKey === "ภาพปก";
}

function getCoverPriority(image: PublicVillaImage): number {
  if (isCoverZone(image.zone)) {
    return 2;
  }

  return image.isCover ? 1 : 0;
}

export function buildGalleryItems(images: PublicVillaImage[]): GalleryItem[] {
  const seenUrls = new Set<string>();
  const items: GalleryItem[] = [];
  const sortedImages = [...images].sort((a, b) => {
    const aCoverPriority = getCoverPriority(a);
    const bCoverPriority = getCoverPriority(b);

    if (aCoverPriority === bCoverPriority) {
      return aCoverPriority > 0 ? b.id - a.id : a.id - b.id;
    }
    return bCoverPriority - aCoverPriority;
  });
  for (const image of sortedImages) {
    if (image.imageUrl && !seenUrls.has(image.imageUrl)) {
      const imageIsCover = image.isCover || isCoverZone(image.zone);
      const zone = imageIsCover ? "cover" : image.zone;

      seenUrls.add(image.imageUrl);
      items.push({
        key: `real-${image.id}-${image.imageUrl}`,
        url: image.imageUrl,
        caption: image.caption,
        imageName: image.imageName,
        isCover: imageIsCover,
        isMock: false,
        zone,
        zoneLabel: getImageZoneLabel(zone),
        zoneKey: getImageZoneKey(zone),
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

export function buildGalleryCategories(
  items: GalleryItem[],
  categoryOrder: readonly string[],
): GalleryCategory[] {
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
  const categoryPositions = new Map(
    categoryOrder.map((categoryKey, index) => [categoryKey, index]),
  );

  return Array.from(categories.values())
    .map((category, index) => ({ category, index }))
    .sort((left, right) => {
      const leftPosition = categoryPositions.get(left.category.key) ?? Infinity;
      const rightPosition = categoryPositions.get(right.category.key) ?? Infinity;
      return leftPosition - rightPosition || left.index - right.index;
    })
    .map(({ category }) => category);
}

export function getGalleryItemDescription(item: GalleryItem): string {
  const caption = item.caption?.trim();
  if (caption && caption.toLowerCase() !== item.zoneKey) {
    return caption;
  }
  return "รูปบ้านพัก";
}

export function findSection(content: VillaDetailContent, title: string): VillaDetailSection | null {
  return content.sections.find((section) => section.title === title) ?? null;
}

export function findFact(facts: VillaDetailFact[], label: string): string | null {
  return facts.find((fact) => fact.label === label)?.value ?? null;
}
