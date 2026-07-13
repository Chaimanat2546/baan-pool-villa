/**
 * @vitest-environment jsdom
 */
import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  readAdminAccessToken: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onNavigate: _onNavigate,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
    onNavigate?: (event: { preventDefault: () => void }) => void;
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSelectedLayoutSegment: () => "brand",
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: mocks.readAdminAccessToken,
}));

import { click, flushEffects } from "@/components/admin/__tests__/admin-page-dom-test-utils";
import { SettingsLayoutShell } from "../settings-layout-shell";
import { SettingsSectionSkeleton } from "../settings-section-skeleton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("SettingsLayoutShell", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.readAdminAccessToken.mockReset();
    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  function mount() {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <SettingsLayoutShell>
          <div data-testid="section-editor">editor</div>
        </SettingsLayoutShell>,
      );
    });

    return { container, root };
  }

  it("keeps the section editor inside the persistent settings shell", () => {
    const mounted = mount();

    expect(mounted.container.querySelector("aside")).not.toBeNull();
    expect(
      mounted.container.querySelector('[data-testid="section-editor"]'),
    ).not.toBeNull();

    act(() => mounted.root.unmount());
  });

  it("renders only one settings sidebar while a section is loading", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SettingsLayoutShell>
          <SettingsSectionSkeleton />
        </SettingsLayoutShell>,
      );
    });

    expect(container.querySelectorAll("aside")).toHaveLength(1);
    expect(
      container.querySelectorAll('nav[aria-label="ส่วนการตั้งค่าเว็บไซต์"]'),
    ).toHaveLength(1);

    act(() => root.unmount());
  });

  it("preserves two-click refresh confirmation, request headers, and cooldown", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "refresh complete",
          refreshed: true,
          retryAfterSeconds: 30,
          scope: "tags-only",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const mounted = mount();
    const refreshButton = [...mounted.container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("รีเฟรชข้อมูลบ้านพัก"),
    ) as HTMLButtonElement;

    await click(refreshButton);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshButton.textContent).toContain("ยืนยันรีเฟรชข้อมูล");

    await click(refreshButton);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/external-data/refresh",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer admin-token",
          "x-admin-refresh-confirmation": "external-villa-cache",
          "x-admin-refresh-scope": "tags-only",
        },
        method: "POST",
      }),
    );
    expect(refreshButton.textContent).toContain("รออีก 30 วินาที");
    expect(mounted.container.textContent).toContain("อัปเดตข้อมูล");

    act(() => mounted.root.unmount());
  });

  it("redirects missing refresh sessions and keeps API failures inline", async () => {
    mocks.readAdminAccessToken.mockResolvedValueOnce(null);
    const mounted = mount();
    let refreshButton = [...mounted.container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("รีเฟรชข้อมูลบ้านพัก"),
    ) as HTMLButtonElement;

    await click(refreshButton);
    await click(refreshButton);
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");

    act(() => mounted.root.unmount());

    mocks.readAdminAccessToken.mockResolvedValue("admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "refresh failed" }), {
          headers: { "Content-Type": "application/json" },
          status: 500,
        }),
      ),
    );
    const failed = mount();
    refreshButton = [...failed.container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("รีเฟรชข้อมูลบ้านพัก"),
    ) as HTMLButtonElement;

    await click(refreshButton);
    await click(refreshButton);
    await flushEffects();

    expect(failed.container.textContent).toContain("refresh failed");
    expect(mocks.replace).toHaveBeenCalledTimes(1);

    act(() => failed.root.unmount());
  });
});
