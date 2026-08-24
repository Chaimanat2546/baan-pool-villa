/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VillaListing } from "@/lib/villas/types";
import { GalleryOverviewModal } from "../gallery-overview-modal";
import type { GalleryCategory, GalleryItem } from "../types";

const listing: VillaListing = {
  amenities: [],
  bathrooms: 2,
  bedrooms: 3,
  coverImage: null,
  distanceToSea: "500m",
  id: "141",
  people: 8,
  poolType: "private",
  price: 12000,
  title: "บ้านพักทดสอบ",
  zone: "jomtien",
  zoneLabel: "Jomtien",
};

function makeItem(key: string, zoneKey: string, zoneLabel: string): GalleryItem {
  return {
    caption: null,
    imageName: `${key}.jpg`,
    isCover: false,
    isMock: false,
    key,
    url: `https://cdn.test/${key}.jpg`,
    zone: zoneKey,
    zoneKey,
    zoneLabel,
  };
}

const poolItem = makeItem("pool-1", "pool", "สระว่ายน้ำ");
const bedroomItem = makeItem("bedroom-1", "bedroom", "ห้องนอน");
const categories: GalleryCategory[] = [
  { items: [poolItem], key: "pool", label: "สระว่ายน้ำ" },
  { items: [bedroomItem], key: "bedroom", label: "ห้องนอน" },
];

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GalleryOverviewModal", () => {
  it("renders grouped categories with configured colors and opens a selected image", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <GalleryOverviewModal
          categories={categories}
          listing={listing}
          onClose={() => undefined}
          onImageError={() => undefined}
          onSelect={onSelect}
          style={{
            backgroundColor: "#112233",
            textColor: "#fefefe",
            variant: "categorized-grid",
          }}
        />,
      );
    });

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.className).toContain("z-[90]");
    expect(dialog.style.getPropertyValue("--gallery-modal-background")).toBe(
      "#112233",
    );
    expect(dialog.style.getPropertyValue("--gallery-modal-text")).toBe("#fefefe");
    expect(container.textContent).toContain("ประเภทรูป");
    expect(container.textContent).toContain("สระว่ายน้ำ");
    expect(container.textContent).toContain("ห้องนอน");

    const masonry = container.querySelector(
      '[data-gallery-overview-masonry="pool"]',
    );
    expect(masonry).not.toBeNull();

    const imageButton = container.querySelector(
      '[data-gallery-overview-item="pool-1"]',
    ) as HTMLButtonElement;
    expect(imageButton.className).not.toContain("aspect-[4/3]");

    const image = imageButton.querySelector("img") as HTMLImageElement;
    expect(image.className).toContain("object-contain");
    expect(image.className).not.toContain("object-cover");
    expect(image.getAttribute("src")).not.toBe("https://cdn.test/pool-1.jpg");

    await act(async () => {
      imageButton.click();
    });

    expect(onSelect).toHaveBeenCalledWith(poolItem);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("closes with Escape", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <GalleryOverviewModal
          categories={categories}
          listing={listing}
          onClose={onClose}
          onImageError={() => undefined}
          onSelect={() => undefined}
          style={{ variant: "categorized-grid" }}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("packs items into the shortest responsive column with equal gaps", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const items = [
      makeItem("pool-1", "pool", "Pool"),
      makeItem("pool-2", "pool", "Pool"),
      makeItem("pool-3", "pool", "Pool"),
      makeItem("pool-4", "pool", "Pool"),
    ];

    await act(async () => {
      root.render(
        <GalleryOverviewModal
          categories={[{ items, key: "pool", label: "Pool" }]}
          listing={listing}
          onClose={() => undefined}
          onImageError={() => undefined}
          onSelect={() => undefined}
          style={{ variant: "categorized-grid" }}
        />,
      );
    });

    const masonry = container.querySelector(
      '[data-gallery-overview-masonry="pool"]',
    ) as HTMLDivElement;
    Object.defineProperty(masonry, "clientWidth", { value: 1000 });

    const buttons = Array.from(
      masonry.querySelectorAll<HTMLButtonElement>("[data-gallery-overview-item]"),
    );
    [100, 200, 50, 80].forEach((height, index) => {
      Object.defineProperty(buttons[index], "offsetHeight", { value: height });
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(buttons[0].style.transform).toBe("translate3d(0px, 0px, 0)");
    expect(buttons[1].style.transform).toContain("337.333");
    expect(buttons[2].style.transform).toContain("674.666");
    expect(buttons[3].style.transform).toContain("62px");
    expect(masonry.style.height).toBe("200px");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
