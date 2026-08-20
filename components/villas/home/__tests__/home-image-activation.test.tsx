/* @vitest-environment jsdom */
/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ fill, loader, preload, ...props }: Record<string, unknown>) => {
    void fill;
    void loader;

    return <img {...props} data-preload={preload ? "true" : undefined} />;
  },
}));

import { ImageActivationContext } from "@/components/ui/near-viewport-activation";
import { ArticlesSection } from "../articles-section";
import { CustomerReviewSection } from "../customer-review-section";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const guide = {
  coverImageAlt: "ภาพหน้าปกคู่มือ",
  coverImageUrl: "https://example.com/guide.jpg",
  excerpt: "รายละเอียดคู่มือ",
  hasCoverImage: true,
  id: "guide-1",
  isPinned: false,
  slug: "guide-1",
  tags: [],
  title: "คู่มือพูลวิลล่า",
};

const customerReviews = {
  images: [
    {
      alt: "หลักฐานรีวิวลูกค้า",
      id: "review-1",
      order: 1,
      url: "https://example.com/review.jpg",
    },
  ],
  layout: "proof_wall" as const,
};

function renderSections(active: boolean) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    async mount() {
      await act(async () => {
        root.render(
          <ImageActivationContext value={active}>
            <ArticlesSection guides={[guide]} />
            <CustomerReviewSection data={customerReviews} />
          </ImageActivationContext>,
        );
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("homepage image activation", () => {
  it("keeps article links and review buttons accessible while inactive images are neutral", async () => {
    const page = renderSections(false);
    await page.mount();

    expect(page.container.querySelector('a[href="/guides/guide-1"]')?.textContent).toContain(
      "คู่มือพูลวิลล่า",
    );
    expect(page.container.querySelector('button[aria-label="หลักฐานรีวิวลูกค้า"]')).not.toBeNull();
    expect(page.container.querySelectorAll("img")).toHaveLength(0);
    expect(page.container.querySelectorAll("[data-progressive-image-fallback]")).toHaveLength(2);

    await page.unmount();
  });

  it("makes article and review preview plus full images available after activation", async () => {
    const page = renderSections(true);
    await page.mount();

    expect(page.container.querySelectorAll("[data-progressive-preview]")).toHaveLength(2);
    expect(page.container.querySelectorAll("[data-progressive-full]")).toHaveLength(2);

    await page.unmount();
  });
});
