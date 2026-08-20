/* @vitest-environment jsdom */

import { act } from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SITE_CONTACT_SETTINGS } from "@/lib/site-contact-settings/defaults";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/defaults";
import type { HomePageLayoutItem } from "@/lib/home-sections/types";
import { toHomePageSettings } from "../client-payload";
import { DeferredHomeContent } from "../deferred-home-content";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settings = toHomePageSettings(
  DEFAULT_SITE_SETTINGS,
  DEFAULT_SITE_CONTACT_SETTINGS,
);

const payload = {
  customerReviews: {
    images: [
      {
        alt: "Deferred customer proof",
        id: "review-1",
        order: 1,
        url: "/api/customer-reviews/images/review-1",
      },
    ],
    layout: "proof_wall" as const,
  },
  degradedSources: {
    guidePosts: false,
    homeSections: false,
    villaCatalog: false,
  },
  guides: [
    {
      coverImageAlt: "Deferred guide cover",
      coverImageUrl: "/api/guides/images/deferred-guide/cover",
      excerpt: "Deferred guide excerpt",
      hasCoverImage: true,
      id: "guide-1",
      isPinned: false,
      slug: "deferred-guide",
      tags: ["pattaya"],
      title: "Deferred guide",
    },
  ],
  layout: [
    { kind: "fixed" as const, key: "articles" as const, enabled: true },
    { kind: "rail" as const, key: "later", enabled: true },
    {
      kind: "fixed" as const,
      key: "customer_reviews" as const,
      enabled: true,
    },
  ],
  sections: [
    {
      autoScrollEnabled: false,
      description: "Deferred rail description",
      slug: "later",
      title: "Deferred rail",
      villas: [
        {
          amenities: [],
          bathrooms: 2,
          bedrooms: 3,
          coverImage: "/api/houses/images/2",
          distanceToSea: "500 เมตร",
          id: "2",
          people: 8,
          poolType: "private",
          price: 9000,
          title: "Deferred villa",
          zone: "jomtien",
          zoneLabel: "จอมเทียน",
        },
      ],
    },
  ],
};

function createObserverDouble() {
  let callback: IntersectionObserverCallback | undefined;
  let options: IntersectionObserverInit | undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();

  class ObserverDouble {
    constructor(
      nextCallback: IntersectionObserverCallback,
      nextOptions: IntersectionObserverInit,
    ) {
      callback = nextCallback;
      options = nextOptions;
    }
    disconnect = disconnect;
    observe = observe;
    takeRecords = () => [];
    unobserve = vi.fn();
  }

  return {
    activate() {
      callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    },
    disconnect,
    observe,
    options: () => options,
    ObserverDouble,
  };
}

function renderDeferredContent({
  criticalContent = <section id="critical">Critical rail</section>,
  criticalRailKey = "critical",
  homeLayout = [
    { kind: "rail", key: "critical", enabled: true },
    ...payload.layout,
  ],
}: {
  criticalContent?: React.ReactNode;
  criticalRailKey?: string | null;
  homeLayout?: HomePageLayoutItem[];
} = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  return {
    container,
    async mount() {
      await act(async () => {
        root.render(
          <DeferredHomeContent
            criticalContent={criticalContent}
            criticalRailKey={criticalRailKey}
            homeLayout={homeLayout}
            settings={settings}
            villaCardStyle="classic"
          />,
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("DeferredHomeContent", () => {
  it("renders a stable placeholder for every deferred item in the saved layout", async () => {
    const observer = createObserverDouble();
    vi.stubGlobal("IntersectionObserver", observer.ObserverDouble);
    vi.stubGlobal("fetch", vi.fn());
    const page = renderDeferredContent({
      homeLayout: [
        { kind: "fixed", key: "why_choose", enabled: true },
        { kind: "fixed", key: "tiktok", enabled: true },
        { kind: "rail", key: "critical", enabled: true },
        { kind: "fixed", key: "articles", enabled: true },
        { kind: "rail", key: "later", enabled: true },
        { kind: "fixed", key: "contact", enabled: true },
      ],
    });
    await page.mount();

    const placeholders = Array.from(
      page.container.querySelectorAll("[data-home-deferred-placeholder-key]"),
    );
    expect(
      placeholders.map((element) =>
        element.getAttribute("data-home-deferred-placeholder-key"),
      ),
    ).toEqual(["why_choose", "tiktok", "articles", "later", "contact"]);
    expect(
      placeholders.map((element) =>
        element.getAttribute("data-home-deferred-placeholder-kind"),
      ),
    ).toEqual(["fixed", "fixed", "fixed", "rail", "fixed"]);

    const markup = page.container.innerHTML;
    expect(markup.indexOf('data-home-deferred-placeholder-key="tiktok"')).toBeLessThan(
      markup.indexOf('id="critical"'),
    );
    expect(markup.indexOf('id="critical"')).toBeLessThan(
      markup.indexOf('data-home-deferred-placeholder-key="articles"'),
    );
    expect(page.container.querySelectorAll("[data-home-deferred-trigger]")).toHaveLength(1);

    await page.unmount();
  });

  it("preserves the mounted critical rail instance when deferred content becomes ready", async () => {
    const observer = createObserverDouble();
    vi.stubGlobal("IntersectionObserver", observer.ObserverDouble);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      ),
    );
    let mounts = 0;
    let unmounts = 0;

    function StatefulCriticalRail() {
      const [position, setPosition] = useState(0);
      useEffect(() => {
        mounts += 1;
        return () => {
          unmounts += 1;
        };
      }, []);

      return (
        <button id="critical" type="button" onClick={() => setPosition(7)}>
          Position {position}
        </button>
      );
    }

    const page = renderDeferredContent({
      criticalContent: <StatefulCriticalRail />,
    });
    await page.mount();
    await act(async () => {
      page.container.querySelector<HTMLButtonElement>("#critical")?.click();
    });
    expect(page.container.querySelector("#critical")?.textContent).toContain("7");

    await act(async () => {
      observer.activate();
    });
    await act(async () => undefined);

    expect(page.container.querySelector("#critical")?.textContent).toContain("7");
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);

    await page.unmount();
  });

  it("keeps deferred fixed items on their saved sides of the critical rail", async () => {
    const observer = createObserverDouble();
    vi.stubGlobal("IntersectionObserver", observer.ObserverDouble);
    const orderedPayload = {
      ...payload,
      layout: [
        { kind: "fixed" as const, key: "articles" as const, enabled: true },
        { kind: "fixed" as const, key: "why_choose" as const, enabled: true },
      ],
      sections: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(orderedPayload), { status: 200 }),
      ),
    );
    const page = renderDeferredContent({
      homeLayout: [
        { kind: "fixed", key: "why_choose", enabled: true },
        { kind: "rail", key: "critical", enabled: true },
        { kind: "fixed", key: "articles", enabled: true },
      ],
    });
    await page.mount();

    const loadingIndex = page.container.innerHTML.indexOf(
      'data-home-deferred-state="loading"',
    );
    const initialCriticalIndex = page.container.innerHTML.indexOf(
      'id="critical"',
    );
    expect(loadingIndex).toBeGreaterThan(-1);
    expect(loadingIndex).toBeLessThan(initialCriticalIndex);
    expect(page.container.innerHTML).not.toContain('id="recommendations"');
    expect(page.container.innerHTML).not.toContain('id="guides"');

    await act(async () => {
      observer.activate();
    });
    await act(async () => undefined);

    const whyChooseIndex = page.container.innerHTML.indexOf(
      'id="recommendations"',
    );
    const criticalIndex = page.container.innerHTML.indexOf('id="critical"');
    const articlesIndex = page.container.innerHTML.indexOf('id="guides"');
    expect(whyChooseIndex).toBeGreaterThan(-1);
    expect(whyChooseIndex).toBeLessThan(criticalIndex);
    expect(criticalIndex).toBeLessThan(articlesIndex);

    await page.unmount();
  });

  it("requests cached deferred content once at 1000px and renders the saved order", async () => {
    const observer = createObserverDouble();
    vi.stubGlobal("IntersectionObserver", observer.ObserverDouble);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const page = renderDeferredContent();
    await page.mount();

    expect(observer.options()).toEqual({ rootMargin: "1000px" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(page.container.textContent).not.toContain("Deferred villa");
    expect(page.container.textContent).not.toContain("Deferred guide");
    expect(page.container.textContent).not.toContain("Deferred customer proof");

    await act(async () => {
      observer.activate();
    });
    await act(async () => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/home-deferred?criticalRail=critical",
      expect.objectContaining({ cache: "force-cache", signal: expect.any(AbortSignal) }),
    );

    const guidesIndex = page.container.innerHTML.indexOf('id="guides"');
    const railIndex = page.container.innerHTML.indexOf('id="later"');
    const reviewsIndex = page.container.innerHTML.indexOf(
      'id="customer-reviews"',
    );
    expect(guidesIndex).toBeGreaterThan(-1);
    expect(guidesIndex).toBeLessThan(railIndex);
    expect(railIndex).toBeLessThan(reviewsIndex);

    await act(async () => {
      observer.activate();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await page.unmount();
  });

  it("shows a stable error fallback for failed responses", async () => {
    const observer = createObserverDouble();
    vi.stubGlobal("IntersectionObserver", observer.ObserverDouble);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    const page = renderDeferredContent();
    await page.mount();

    await act(async () => {
      observer.activate();
    });
    await act(async () => undefined);

    expect(
      page.container.querySelector('[data-home-deferred-state="error"]'),
    ).not.toBeNull();
    expect(page.container.querySelector('[data-villa-rail-skeleton="true"]')).not.toBeNull();

    await page.unmount();
  });

  it("aborts an active request on unmount without surfacing an error", async () => {
    const observer = createObserverDouble();
    vi.stubGlobal("IntersectionObserver", observer.ObserverDouble);
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );
    const page = renderDeferredContent();
    await page.mount();

    await act(async () => {
      observer.activate();
    });
    expect(requestSignal?.aborted).toBe(false);

    await page.unmount();

    expect(requestSignal?.aborted).toBe(true);
  });
});
