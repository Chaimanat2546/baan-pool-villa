/* @vitest-environment jsdom */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NearViewportActivation,
  useImageActivation,
} from "../near-viewport-activation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ActivationStatus() {
  return <output data-active={useImageActivation() ? "true" : "false"} />;
}

function renderBoundary(initiallyActive = false, rootMargin = "1000px") {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    async mount() {
      await act(async () => {
        root.render(
          <NearViewportActivation initiallyActive={initiallyActive} rootMargin={rootMargin}>
            <ActivationStatus />
          </NearViewportActivation>,
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("NearViewportActivation", () => {
  it("activates once after an intersecting entry and disconnects its exact observer", async () => {
    let callback: IntersectionObserverCallback | undefined;
    let options: IntersectionObserverInit | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();

    class ObserverDouble {
      constructor(nextCallback: IntersectionObserverCallback, nextOptions: IntersectionObserverInit) {
        callback = nextCallback;
        options = nextOptions;
      }
      disconnect = disconnect;
      observe = observe;
      takeRecords = () => [];
      unobserve = vi.fn();
    }

    vi.stubGlobal("IntersectionObserver", ObserverDouble);
    const page = renderBoundary(false, "1000px");
    await page.mount();

    expect(options).toEqual({ rootMargin: "1000px" });
    expect(observe).toHaveBeenCalledWith(
      page.container.querySelector('[data-near-viewport-activation]'),
    );
    expect(page.container.querySelector("output")?.getAttribute("data-active")).toBe("false");

    await act(async () => {
      callback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(page.container.querySelector("output")?.getAttribute("data-active")).toBe("false");

    await act(async () => {
      callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(page.container.querySelector("output")?.getAttribute("data-active")).toBe("true");
    expect(disconnect).toHaveBeenCalledTimes(1);

    await act(async () => {
      callback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(page.container.querySelector("output")?.getAttribute("data-active")).toBe("true");

    await page.unmount();
  });

  it("activates after its effect when IntersectionObserver is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", undefined);
    const page = renderBoundary();
    await page.mount();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(page.container.querySelector("output")?.getAttribute("data-active")).toBe("true");

    await page.unmount();
  });
});
