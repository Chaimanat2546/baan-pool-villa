/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";

import { SiteHeader } from "../site-header";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} />
  ),
}));

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
  });
}

async function renderHeader() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<SiteHeader settings={DEFAULT_SITE_SETTINGS} />);
  });

  return { container, root };
}

async function scrollTo(value: number) {
  await act(async () => {
    setScrollY(value);
    window.dispatchEvent(new Event("scroll"));
    await Promise.resolve();
  });
}

function mockAnimationFrame() {
  let callback: FrameRequestCallback | null = null;

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((nextCallback) => {
    callback = nextCallback;
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
    callback = null;
  });

  return async () => {
    await act(async () => {
      callback?.(0);
      await Promise.resolve();
    });
  };
}

describe("SiteHeader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    setScrollY(0);
  });

  it("renders the bank account notice with readable navbar text tokens", () => {
    const markup = renderToStaticMarkup(
      <SiteHeader settings={DEFAULT_SITE_SETTINGS} />,
    );

    expect(markup).toContain(DEFAULT_SITE_SETTINGS.bank.accountNumber);
    expect(markup).toContain("text-[var(--site-on-primary)]");
    expect(markup).toContain("text-[var(--site-accent-on-dark)]");
  });

  it("hides when scrolling down and shows when scrolling up", async () => {
    const flushAnimationFrame = mockAnimationFrame();
    setScrollY(0);
    const { container, root } = await renderHeader();

    try {
      const header = container.querySelector("header");

      await scrollTo(80);
      await flushAnimationFrame();
      expect(header?.getAttribute("data-header-hidden")).toBe("true");

      await scrollTo(40);
      await flushAnimationFrame();
      expect(header?.getAttribute("data-header-hidden")).toBe("false");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });

  it("keeps the header visible while the mobile menu is open", async () => {
    const flushAnimationFrame = mockAnimationFrame();
    setScrollY(0);
    const { container, root } = await renderHeader();

    try {
      await act(async () => {
        container.querySelector("button")?.click();
      });

      await scrollTo(80);
      await flushAnimationFrame();

      expect(container.querySelector("header")?.getAttribute("data-header-hidden")).toBe(
        "false",
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });
});
