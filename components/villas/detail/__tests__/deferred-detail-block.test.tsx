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
      new Response(JSON.stringify({ sections: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const showLazyBlock = stubIntersectionObserver();
    const page = render(
      <LazyDetailBlock name="recommended_villas">
        <DeferredRecommendedVillas />
      </LazyDetailBlock>,
    );

    await page.mount();
    await flushReact();

    expect(fetchMock).not.toHaveBeenCalled();

    await showLazyBlock();

    expect(fetchMock).toHaveBeenCalledWith("/api/home-sections");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await page.unmount();
  });
});
