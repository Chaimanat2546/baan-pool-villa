// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_WEB_STYLES } from "@/lib/site-web-styles/defaults";
import type { ReviewPage } from "@/lib/villa-reviews/types";
import { VillaReviewsSection } from "../villa-reviews-section";

let root: Root;
let host: HTMLDivElement;
const fetchMock = vi.fn();
const item = (id: number) => ({
  id: String(id),
  villaId: "villa-1",
  rating: 5,
  comment: `รีวิวลำดับ ${id}`,
  maskedPhone: "xxx-xxxx-5678",
  images: [],
  createdAt: "2026-09-07T00:00:00Z",
  updatedAt: "2026-09-07T00:00:00Z",
});
const page: ReviewPage = {
  items: [1, 2, 3, 4, 5].map(item),
  nextCursor: "next-page",
  summary: {
    totalCount: 6,
    averageRating: 5,
    ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 6 },
  },
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("review section", () => {
  it("loads five, resets sorting and appends the cursor page without duplicates", async () => {
    await act(async () =>
      root.render(<VillaReviewsSection villaId="villa-1" initialPage={page} />),
    );
    expect(host.querySelectorAll("article")).toHaveLength(5);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => page });
    await act(async () => {
      const select = host.querySelector("select")!;
      select.value = "rating_desc";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(fetchMock.mock.calls[0][0]).toContain("sort=rating_desc");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...page,
        items: [item(5), item(6)],
        nextCursor: null,
      }),
    });
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((node) => node.textContent?.includes("ดูรีวิวเพิ่มเติม"))!
        .click(),
    );
    expect(fetchMock.mock.calls[1][0]).toContain("cursor=next-page");
    expect(host.querySelectorAll("article")).toHaveLength(6);
    expect(host.textContent).toContain("รีวิวลำดับ 6");
  });
  it("shows loading, recoverable errors, and a real empty state", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await act(async () =>
      root.render(<VillaReviewsSection villaId="villa-1" />),
    );
    expect(host.textContent).toContain("โหลดรีวิวไม่สำเร็จ");
    expect(host.textContent).not.toContain("ยังไม่มีรีวิว");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...page,
        items: [],
        nextCursor: null,
        summary: { ...page.summary, totalCount: 0, averageRating: 0 },
      }),
    });
    await act(async () =>
      Array.from(host.querySelectorAll("button"))
        .find((node) => node.textContent?.includes("ลองอีกครั้ง"))!
        .click(),
    );
    expect(host.textContent).toContain("ยังไม่มีรีวิว");
  });
  it("wraps long comments and substitutes broken images", async () => {
    const review = {
      ...item(1),
      comment: "ก".repeat(1000),
      images: [{ id: "image-1", url: "https://example.com/image.jpg" }],
    };
    await act(async () =>
      root.render(
        <VillaReviewsSection
          villaId="villa-1"
          initialPage={{ ...page, items: [review] }}
        />,
      ),
    );
    expect(host.querySelector("article p")?.className).toContain("break-words");
    await act(async () =>
      host.querySelector("img")!.dispatchEvent(new Event("error")),
    );
    expect(host.textContent).toContain("โหลดรูปไม่ได้");
  });

  it("opens every image from one review in the shared lightbox", async () => {
    const review = {
      ...item(1),
      images: [
        { id: "image-1", url: "https://example.com/image-1.jpg" },
        { id: "image-2", url: "https://example.com/image-2.jpg" },
      ],
    };
    await act(async () =>
      root.render(
        <VillaReviewsSection
          villaId="villa-1"
          initialPage={{ ...page, items: [review] }}
        />,
      ),
    );

    const trigger = host.querySelector<HTMLButtonElement>(
      '[aria-label="ดูรูปจากผู้เข้าพัก รูปที่ 1"]',
    );
    expect(trigger).not.toBeNull();
    await act(async () => trigger?.click());

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain("รูปจากผู้เข้าพัก");
    expect(host.querySelectorAll('[aria-label^="ดูรูปหมวด"]')).toHaveLength(2);
    expect(host.textContent).toContain("เลือกหมวดหมู่");
    expect(
      host.querySelector('[data-gallery-thumbnail-placement="side"]'),
    ).not.toBeNull();
  });

  it("uses the configured gallery style for review image lightboxes", async () => {
    const review = {
      ...item(1),
      images: [{ id: "image-1", url: "https://example.com/image-1.jpg" }],
    };
    await act(async () =>
      root.render(
        <VillaReviewsSection
          galleryStyle={{
            ...DEFAULT_SITE_WEB_STYLES.gallery,
            backgroundColor: "#123456",
            textColor: "#fefefe",
            variant: "categorized-grid",
          }}
          villaId="villa-1"
          initialPage={{ ...page, items: [review] }}
        />,
      ),
    );

    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          '[aria-label="ดูรูปจากผู้เข้าพัก รูปที่ 1"]',
        )
        ?.click(),
    );

    expect(host.querySelector('[role="dialog"]')?.getAttribute("style")).toContain(
      "--gallery-modal-background: #123456",
    );
    expect(
      host.querySelector('[data-gallery-thumbnail-placement="bottom"]'),
    ).not.toBeNull();
    expect(host.textContent).not.toContain("เลือกหมวดหมู่");
  });
});
