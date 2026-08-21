/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mountAdminPage } from "@/components/admin/__tests__/admin-page-dom-test-utils";

vi.mock("next/script", () => ({
  default: ({ children, id, src }: { children?: ReactNode; id?: string; src?: string }) => (
    <span data-next-script-id={id} data-next-script-src={src}>
      {children}
    </span>
  ),
}));

import { GoogleTagManagerOnInteraction } from "../google-tag-manager-on-interaction";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("GoogleTagManagerOnInteraction", () => {
  it("does not load GTM until the visitor interacts with the page", async () => {
    const page = await mountAdminPage(
      <GoogleTagManagerOnInteraction gtmId="GTM-ABC1234" />,
    );

    expect(page.container.querySelector("[data-next-script-id]")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    expect(
      page.container.querySelector(
        '[data-next-script-src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234"]',
      ),
    ).not.toBeNull();
    expect(
      page.container.querySelector('[data-next-script-id="google-tag-manager-init"]')
        ?.textContent,
    ).toContain("window.dataLayer = window.dataLayer || []");

    await page.unmount();
  });
});
