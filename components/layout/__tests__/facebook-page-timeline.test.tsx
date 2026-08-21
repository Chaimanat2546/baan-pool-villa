/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";

import { FacebookPageTimeline } from "../facebook-page-timeline";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FacebookPageTimeline", () => {
  it("waits until the timeline itself enters the viewport before loading Facebook", async () => {
    let observerOptions: IntersectionObserverInit | undefined;

    class FakeIntersectionObserver {
      constructor(
        _callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        observerOptions = options;
      }

      disconnect() {}

      observe() {}

      takeRecords() {
        return [];
      }

      unobserve() {}
    }

    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    const page = await mountAdminPage(
      <FacebookPageTimeline src="https://www.facebook.com/plugins/page.php?tabs=timeline" />,
    );

    expect(observerOptions?.rootMargin).toBe("0px");
    expect(page.container.querySelector("iframe")).toBeNull();

    await page.unmount();
  });
});
