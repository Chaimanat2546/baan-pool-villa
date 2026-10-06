// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { AnalyticsPageReady } from "../analytics-page-ready";
it("counts a successful strict-mode mount once, ignores hash changes and counts BFCache restore once", async () => {
  const fetch = vi.fn(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  const page = await mountAdminPage(
    <StrictMode>
      <AnalyticsPageReady />
    </StrictMode>,
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
  expect(fetch).toHaveBeenCalledTimes(1);
  act(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  await page.unmount();
  vi.unstubAllGlobals();
});
it("counts returning to a page after it unmounted, without a visitor identifier", async () => {
  const fetch = vi.fn(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  let page = await mountAdminPage(<AnalyticsPageReady />);
  expect(fetch).toHaveBeenCalledTimes(1);
  await page.unmount();
  page = await mountAdminPage(<AnalyticsPageReady />);
  expect(fetch).toHaveBeenCalledTimes(2);
  await page.unmount();
  vi.unstubAllGlobals();
});
