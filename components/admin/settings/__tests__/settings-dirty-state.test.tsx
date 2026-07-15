/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SettingsDirtyStateProvider,
  useSettingsDirtyState,
} from "../settings-dirty-state";
import { SettingsSectionHeader } from "../settings-section-header";

describe("SettingsDirtyStateProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("registers beforeunload only while dirty and removes it on cleanup", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const container = document.createElement("div");
    const root = createRoot(container);
    let setIsDirty: ((value: boolean) => void) | null = null;

    function Probe() {
      setIsDirty = useSettingsDirtyState().setIsDirty;
      return null;
    }

    act(() => root.render(<SettingsDirtyStateProvider><Probe /></SettingsDirtyStateProvider>));
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

    act(() => setIsDirty?.(true));
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    act(() => setIsDirty?.(false));
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    act(() => root.unmount());
  });

  it("keeps the page dirty until every keyed editor is clean", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let isDirty = false;
    let setDirtySource: ((key: string, value: boolean) => void) | null = null;

    function Probe() {
      const state = useSettingsDirtyState();
      isDirty = state.isDirty;
      setDirtySource = state.setDirtySource;
      return null;
    }

    act(() => root.render(<SettingsDirtyStateProvider><Probe /></SettingsDirtyStateProvider>));
    act(() => {
      setDirtySource?.("header", true);
      setDirtySource?.("gallery", true);
    });
    expect(isDirty).toBe(true);

    act(() => setDirtySource?.("header", false));
    expect(isDirty).toBe(true);

    act(() => setDirtySource?.("gallery", false));
    expect(isDirty).toBe(false);
    act(() => root.unmount());
  });

  it("renders the shared public-site link and section save button", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const disconnect = vi.fn();
    const observe = vi.fn();
    const observerOptions: IntersectionObserverInit[] = [];
    let callback: IntersectionObserverCallback | null = null;
    let isDesktop = false;
    let mediaChange: ((event: MediaQueryListEvent) => void) | null = null;

    const mediaQuery = {
      get matches() {
        return isDesktop;
      },
      addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === "change") mediaChange = listener;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;

    class MockIntersectionObserver {
      constructor(nextCallback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        callback = nextCallback;
        observerOptions.push(options);
      }

      disconnect = disconnect;
      observe = observe;
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

    act(() => {
      root.render(
        <SettingsSectionHeader
          description="รายละเอียด"
          hasUnsavedChanges
          isSaving={false}
          onSave={vi.fn()}
          title="สีและธีม"
        />,
      );
    });

    expect(container.querySelector('a[href="/"]')?.getAttribute("target")).toBe("_blank");
    expect(container.textContent).not.toContain("รีเฟรช");
    expect(container.querySelector("button")?.textContent).toContain("บันทึกส่วนนี้");

    const header = container.querySelector("[data-settings-section-header]");
    const description = container.querySelector("[data-settings-section-description]");
    const sentinel = container.querySelector('[aria-hidden="true"]');

    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-16");
    expect(header?.className).toContain("lg:top-0");
    expect(header?.getAttribute("data-compact")).toBe("false");
    expect(description?.className).toContain("group-data-[compact=true]:hidden");
    expect(observe).toHaveBeenCalledWith(sentinel);
    expect(observerOptions[0]?.rootMargin).toBe("-64px 0px 0px 0px");

    isDesktop = true;
    act(() => {
      mediaChange?.({ matches: true } as MediaQueryListEvent);
    });
    expect(observerOptions[1]?.rootMargin).toBe("0px");

    act(() => {
      callback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(header?.getAttribute("data-compact")).toBe("true");
    expect(description?.className).toContain("group-data-[compact=true]:hidden");

    act(() => {
      callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(header?.getAttribute("data-compact")).toBe("false");

    act(() => root.unmount());
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
