/**
 * @vitest-environment jsdom
 */
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeferredRecommendedVillas,
  LazyDetailBlock,
} from "../deferred-detail-block";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function render(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    async mount() {
      await act(async () => {
        root.render(element);
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

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function stubIntersectionObserver() {
  let show: (() => void) | null = null;

  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];

    constructor(callback: IntersectionObserverCallback) {
      show = () => {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this,
        );
      };
    }

    disconnect = vi.fn();
    observe = vi.fn();
    takeRecords = () => [];
    unobserve = vi.fn();
  }

  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

  return async () => {
    await act(async () => {
      show?.();
    });
    await flushReact();
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("deferred detail blocks", () => {
  it("loads recommended villas only after the lazy block enters the viewport", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          sections: [
            {
              description: "Recommended villas",
              slug: "featured",
              title: "Featured villas",
              villas: [
                {
                  amenities: [],
                  bathrooms: 2,
                  bedrooms: 3,
                  coverImage: null,
                  distanceToSea: "1 km",
                  id: "77",
                  people: 8,
                  poolType: "private",
                  price: 9000,
                  zone: "pattaya",
                  zoneLabel: "Pattaya",
                },
              ],
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const showLazyBlock = stubIntersectionObserver();
    const page = render(
      <LazyDetailBlock name="recommended_villas">
        <DeferredRecommendedVillas villaCardStyle="gallery" />
      </LazyDetailBlock>,
    );

    await page.mount();
    await flushReact();

    expect(fetchMock).not.toHaveBeenCalled();

    await showLazyBlock();

    expect(fetchMock).toHaveBeenCalledWith("/api/home-sections");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(page.container.querySelectorAll("button")).toHaveLength(2);
    expect(
      page.container.querySelector(
        '[data-villa-card-style="gallery"]',
      ),
    ).not.toBeNull();
    expect(
      page.container.querySelector(
        '[data-villa-card-style="classic"]',
      ),
    ).toBeNull();

    await page.unmount();
  });
});
