/**
 * @vitest-environment jsdom
 */
import { act, type AnchorHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  segment: "seo" as string | null,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a data-prefetch={String(prefetch)} href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSelectedLayoutSegment: () => mocks.segment,
}));

vi.mock("@/components/admin/admin-auth", () => ({
  readAdminAccessToken: vi.fn(),
}));

import {
  SettingsDirtyStateProvider,
  useSettingsDirtyState,
} from "../settings-dirty-state";
import { SettingsSidebar } from "../settings-sidebar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("SettingsSidebar", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.segment = "seo";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  function mount() {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let setDirty: ((value: boolean) => void) | null = null;

    function DirtyProbe() {
      setDirty = useSettingsDirtyState().setIsDirty;
      return null;
    }

    act(() => {
      root.render(
        <SettingsDirtyStateProvider>
          <DirtyProbe />
          <SettingsSidebar />
        </SettingsDirtyStateProvider>,
      );
    });

    return {
      container,
      root,
      setDirty(value: boolean) {
        act(() => setDirty?.(value));
      },
    };
  }

  it("renders six Thai section links without prefetch and marks the active section", () => {
    const mounted = mount();
    const links = [...mounted.container.querySelectorAll("nav a")];

    expect(links).toHaveLength(6);
    expect(
      mounted.container.querySelector('a[href="/admin/settings/brand"]')
        ?.textContent,
    ).toContain("ข้อมูลแบรนด์");
    expect(
      mounted.container
        .querySelector('a[href="/admin/settings/theme"]')
        ?.getAttribute("data-prefetch"),
    ).toBe("false");
    expect(
      mounted.container
        .querySelector('a[href="/admin/settings/seo"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");

    act(() => mounted.root.unmount());
  });

  it("uses an accessible mobile disclosure", () => {
    const mounted = mount();
    const toggle = mounted.container.querySelector(
      'button[aria-controls="settings-section-navigation"]',
    ) as HTMLButtonElement;

    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    act(() => toggle.click());

    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    act(() => mounted.root.unmount());
  });

  it("prevents only declined dirty navigation and pushes confirmed navigation", () => {
    const mounted = mount();
    const link = mounted.container.querySelector(
      'a[href="/admin/settings/theme"]',
    ) as HTMLAnchorElement;
    const confirm = vi.spyOn(window, "confirm");

    link.setAttribute("href", "#settings-navigation-test");
    const cleanEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => link.dispatchEvent(cleanEvent));
    expect(cleanEvent.defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();

    mounted.setDirty(true);
    confirm.mockReturnValueOnce(false);
    const declinedEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => link.dispatchEvent(declinedEvent));
    expect(declinedEvent.defaultPrevented).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    const confirmedEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => link.dispatchEvent(confirmedEvent));
    expect(confirmedEvent.defaultPrevented).toBe(true);
    expect(mocks.push).toHaveBeenCalledWith("/admin/settings/theme");

    act(() => mounted.root.unmount());
  });
});
