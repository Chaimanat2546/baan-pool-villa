import type {
  VillaDetailContent,
  VillaDetailFact,
  VillaDetailSection,
} from "@/lib/villas/detail";
import type { VillaImage } from "@/lib/villas/types";
import { IMAGE_ZONE_LABELS } from "./constants";
import type { GalleryCategory, GalleryItem } from "./types";

export function getVillaTitle(id: string): string {
  return `พูลวิลล่า ${id}`;
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

function isCoverZone(zone: string | null): boolean {
  const zoneKey = zone?.trim().toLowerCase();

  return zoneKey === "cover" || zoneKey === "รูปปก" || zoneKey === "ภาพปก";
}

export function buildGalleryItems(images: VillaImage[]): GalleryItem[] {
  const seenUrls = new Set<string>();
  const items: GalleryItem[] = [];
  const sortedImages = [...images].sort((a, b) => {
    const aIsCover = a.isCover || isCoverZone(a.zone);
    const bIsCover = b.isCover || isCoverZone(b.zone);

    if (aIsCover === bIsCover) {
      return a.id - b.id;
    }
    return aIsCover ? -1 : 1;
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
