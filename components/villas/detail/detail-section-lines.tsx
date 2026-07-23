"use client";

/* eslint-disable @next/next/no-img-element -- upstream detail images do not include dimensions */
import { useMemo, useState } from "react";
import type { GalleryStyleSettings } from "@/lib/site-web-styles/types";
import type { VillaListing } from "@/lib/villas/types";
import { GalleryLightbox } from "./gallery-lightbox";
import type { GalleryCategory, GalleryItem } from "./types";

const DETAIL_IMAGE_HOSTNAMES = new Set([
  "devillegroups.com",
  "www.devillegroups.com",
]);

function readAttribute(tag: string, targetName: string): string | null {
  let index = 4;

  while (index < tag.length) {
    while (index < tag.length && /\s/.test(tag[index])) {
      index += 1;
    }

    if (tag[index] === ">" || tag[index] === "/") {
      break;
    }

    const nameStart = index;

    while (index < tag.length && !/[\s=>/]/.test(tag[index])) {
      index += 1;
    }

    const name = tag.slice(nameStart, index).toLowerCase();

    while (index < tag.length && /\s/.test(tag[index])) {
      index += 1;
    }

    if (tag[index] !== "=") {
      continue;
    }

    index += 1;

    while (index < tag.length && /\s/.test(tag[index])) {
      index += 1;
    }

    const quote = tag[index] === "'" || tag[index] === '"' ? tag[index] : null;
    const valueStart = quote ? ++index : index;

    if (quote) {
      while (index < tag.length && tag[index] !== quote) {
        index += 1;
      }
    } else {
      while (index < tag.length && !/[\s>]/.test(tag[index])) {
        index += 1;
      }
    }

    const value = tag.slice(valueStart, index);

    if (quote) {
      index += 1;
    }

    if (name === targetName) {
      return value;
    }
  }

  return null;
}

export function getDetailImageUrl(line: string): string | null {
  const tag = line.trim();

  if (
    !tag.toLowerCase().startsWith("<img") ||
    !/\s/.test(tag[4] ?? "") ||
    !tag.endsWith(">")
  ) {
    return null;
  }

  const source = readAttribute(tag, "src");

  if (!source) {
    return null;
  }

  try {
    const url = new URL(source);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !DETAIL_IMAGE_HOSTNAMES.has(url.hostname.toLowerCase())
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function toGalleryItem(url: string, index: number): GalleryItem {
  return {
    caption: null,
    imageName: null,
    isCover: false,
    isMock: false,
    key: `detail-inline-${index}`,
    url,
    zone: "detail",
    zoneKey: "detail",
    zoneLabel: "รูปภาพรายละเอียด",
  };
}

export function DetailSectionLines({
  galleryStyle,
  lines,
  listing,
}: {
  galleryStyle: GalleryStyleSettings;
  lines: string[];
  listing: VillaListing;
}) {
  const parsedLines = useMemo(
    () =>
      lines.map((line, index) => ({
        image: getDetailImageUrl(line),
        key: `${index}-${line}`,
        line,
      })),
    [lines],
  );
  const items = useMemo(
    () =>
      parsedLines.flatMap(({ image }, index) =>
        image ? [toGalleryItem(image, index)] : [],
      ),
    [parsedLines],
  );
  const categories = useMemo<GalleryCategory[]>(
    () => [{ items, key: "detail", label: "รูปภาพรายละเอียด" }],
    [items],
  );
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {parsedLines.map(({ image, key, line }) => (
          <li className={image ? "" : "flex gap-2"} key={key}>
            {image ? (
              <button
                aria-label="ดูรูปขนาดใหญ่"
                className="block w-full overflow-hidden rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)]"
                data-detail-inline-image="true"
                onClick={() => {
                  setActiveItem(items.find((item) => item.url === image) ?? null);
                }}
                type="button"
              >
                <img
                  alt={`รูปภาพรายละเอียดบ้าน DV-${listing.id}`}
                  className="h-auto max-h-[520px] w-full object-contain"
                  decoding="async"
                  loading="lazy"
                  src={image}
                />
              </button>
            ) : (
              <span>- {line}</span>
            )}
          </li>
        ))}
      </ul>
      <GalleryLightbox
        activeItem={activeItem}
        categories={categories}
        eyebrow="รูปภาพรายละเอียดบ้านพัก"
        listing={listing}
        onClose={() => {
          setActiveItem(null);
        }}
        onImageError={() => {
          setActiveItem(null);
        }}
        onSelect={setActiveItem}
        showCategorySelector={false}
        showDownload={false}
        style={galleryStyle}
        thumbnailPlacement="bottom"
        title={`รูปภาพรายละเอียดบ้าน DV-${listing.id}`}
      />
    </>
  );
}
