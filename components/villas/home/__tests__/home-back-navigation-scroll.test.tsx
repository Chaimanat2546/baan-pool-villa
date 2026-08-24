/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeBackNavigationScroll } from "../home-back-navigation-scroll";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderScrollHandler() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    async mount() {
      await act(async () => {
        root.render(<HomeBackNavigationScroll />);
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
});

describe("HomeBackNavigationScroll", () => {
  it("scrolls to the top when the browser restores the homepage from history", async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal("scrollTo", scrollToMock);
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "back_forward" } as PerformanceNavigationTiming,
    ]);
    const page = renderScrollHandler();

    await page.mount();

    expect(scrollToMock).toHaveBeenCalledWith(0, 0);
    await page.unmount();
  });

  it("keeps the current position for a normal homepage load", async () => {
    const scrollToMock = vi.fn();
    vi.stubGlobal("scrollTo", scrollToMock);
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    const page = renderScrollHandler();

    await page.mount();

    expect(scrollToMock).not.toHaveBeenCalled();
    await page.unmount();
  });
});
