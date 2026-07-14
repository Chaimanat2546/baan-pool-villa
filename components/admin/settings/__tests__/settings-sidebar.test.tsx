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
    onNavigate,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    href: string;
    onNavigate?: (event: { preventDefault: () => void }) => void;
    prefetch?: boolean;
  }) => {
    return (
      <a
        data-prefetch={String(prefetch)}
        href={href}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
          ) {
            return;
          }

          onNavigate?.({ preventDefault: () => event.preventDefault() });
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
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

  it("renders the web-style link without prefetch and marks the active section", () => {
    const mounted = mount();
    const links = [...mounted.container.querySelectorAll("nav a")];

    expect(links).toHaveLength(7);
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
      mounted.container.querySelector('a[href="/admin/settings/web-style"]')
        ?.textContent,
    ).toContain("รูปแบบเว็บ");
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

  it("does not prompt when the current section link is selected", () => {
    const mounted = mount();
    mounted.setDirty(true);
    const activeLink = mounted.container.querySelector(
      'a[href="/admin/settings/seo"]',
    ) as HTMLAnchorElement;
    const confirm = vi.spyOn(window, "confirm");

    activeLink.setAttribute("href", "#active-settings-navigation-test");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => activeLink.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

    act(() => mounted.root.unmount());
  });

  it("prevents declined dirty navigation", () => {
    const mounted = mount();
    mounted.setDirty(true);
    const link = mounted.container.querySelector(
      'a[href="/admin/settings/theme"]',
    ) as HTMLAnchorElement;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    link.setAttribute("href", "#declined-settings-navigation-test");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => link.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();

    act(() => mounted.root.unmount());
  });

  it("accepts dirty navigation without manually pushing", () => {
    const mounted = mount();
    mounted.setDirty(true);
    const link = mounted.container.querySelector(
      'a[href="/admin/settings/theme"]',
    ) as HTMLAnchorElement;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    link.setAttribute("href", "#accepted-settings-navigation-test");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => link.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();

    act(() => mounted.root.unmount());
  });

  it("closes the mobile disclosure on clean navigation", () => {
    const mounted = mount();
    const toggle = mounted.container.querySelector(
      'button[aria-controls="settings-section-navigation"]',
    ) as HTMLButtonElement;
    const link = mounted.container.querySelector(
      'a[href="/admin/settings/theme"]',
    ) as HTMLAnchorElement;

    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    link.setAttribute("href", "#clean-settings-navigation-test");
    act(() => link.click());

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(mocks.push).not.toHaveBeenCalled();

    act(() => mounted.root.unmount());
  });

  it("leaves modifier clicks native and unprompted", () => {
    const mounted = mount();
    mounted.setDirty(true);
    const toggle = mounted.container.querySelector(
      'button[aria-controls="settings-section-navigation"]',
    ) as HTMLButtonElement;
    const link = mounted.container.querySelector(
      'a[href="/admin/settings/theme"]',
    ) as HTMLAnchorElement;
    const confirm = vi.spyOn(window, "confirm");

    act(() => toggle.click());
    link.setAttribute("href", "#modifier-settings-navigation-test");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    act(() => link.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(mocks.push).not.toHaveBeenCalled();

    act(() => mounted.root.unmount());
  });
});
