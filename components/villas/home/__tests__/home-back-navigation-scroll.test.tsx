/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeBackNavigationScroll } from "../home-back-navigation-scroll";
import { HomeHistoryScrollTracker } from "../home-history-scroll-tracker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderScrollHandler() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (showHomepage: boolean) => {
    root.render(
      <>
        <HomeHistoryScrollTracker />
        {showHomepage ? <HomeBackNavigationScroll /> : null}
      </>,
    );
  };

  return {
    async mount() {
      await act(async () => {
        render(true);
      });
    },
    async hideHomepage() {
      await act(async () => {
        render(false);
      });
    },
    async showHomepage() {
      await act(async () => {
        render(true);
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
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
});

describe("HomeBackNavigationScroll", () => {
  it("restores the position only after returning through browser history", async () => {
    const scrollToMock = vi.fn();
    let restoreAfterPaint: FrameRequestCallback | undefined;
    vi.stubGlobal("scrollTo", scrollToMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      restoreAfterPaint = callback;
      return 1;
    });
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    const page = renderScrollHandler();

    await page.mount();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1600 });
    window.dispatchEvent(new Event("scroll"));
    await page.hideHomepage();
    window.history.replaceState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    scrollToMock.mockClear();

    await page.showHomepage();

    expect(scrollToMock).not.toHaveBeenCalled();
    restoreAfterPaint?.(0);
    expect(scrollToMock).toHaveBeenCalledWith(0, 1600);
    await page.unmount();
  });

  it("restores the latest homepage position when revisiting without a refresh", async () => {
    const scrollToMock = vi.fn();
    let restoreAfterPaint: FrameRequestCallback | undefined;
    vi.stubGlobal("scrollTo", scrollToMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      restoreAfterPaint = callback;
      return 1;
    });
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    window.sessionStorage.setItem("home-last-scroll-y", "720");
    const page = renderScrollHandler();

    await page.mount();

    expect(scrollToMock).not.toHaveBeenCalled();
    restoreAfterPaint?.(0);
    expect(scrollToMock).toHaveBeenCalledWith(0, 720);
    await page.unmount();
  });

  it("scrolls to the top on refresh even when a back position is pending", async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal("scrollTo", scrollToMock);
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "reload" } as PerformanceNavigationTiming,
    ]);
    window.sessionStorage.setItem("home-last-scroll-y", "1600");
    const page = renderScrollHandler();

    await page.mount();

    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
    await page.unmount();
  });
});
