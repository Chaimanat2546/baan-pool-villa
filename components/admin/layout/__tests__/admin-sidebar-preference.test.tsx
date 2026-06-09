/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setAdminSidebarPreference,
  useAdminSidebarCollapsed,
} from "../admin-sidebar-preference";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function SidebarPreferenceProbe() {
  const isCollapsed = useAdminSidebarCollapsed();

  return <div data-sidebar-collapsed={String(isCollapsed)} />;
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("admin sidebar preference", () => {
  it("uses an in-memory fallback when localStorage is blocked", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => {
          throw new Error("storage blocked");
        }),
        setItem: vi.fn(() => {
          throw new Error("storage blocked");
        }),
      },
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SidebarPreferenceProbe />);
    });
    expect(
      container.querySelector("[data-sidebar-collapsed]")?.getAttribute(
        "data-sidebar-collapsed",
      ),
    ).toBe("false");

    setAdminSidebarPreference(true);
    await flushEffects();

    expect(
      container.querySelector("[data-sidebar-collapsed]")?.getAttribute(
        "data-sidebar-collapsed",
      ),
    ).toBe("true");

    await act(async () => {
      root.unmount();
    });
  });
});
