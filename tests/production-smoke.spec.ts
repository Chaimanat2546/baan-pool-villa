import { expect, test } from "@playwright/test";
import {
  selectFirstRailFullImageResponseEvents,
  type SuccessfulImageResponseEvent,
} from "./support/production-smoke-image-responses";

const maxNavigationDurationMs = 15_000;

function getSuccessfulImageResponse(response: import("@playwright/test").Response) {
  if (
    !response.ok() ||
    response.request().resourceType() !== "image"
  ) {
    return null;
  }

  return {
    requestIdentity: response.request(),
    url: response.url(),
  } satisfies SuccessfulImageResponseEvent;
}

async function expectNoPublicSecretLeak(html: string) {
  await expect(html).not.toContain("DEVILLE_BEARER_TOKEN");
  await expect(html).not.toContain("SUPABASE_SERVICE_ROLE");
  await expect(html).not.toContain("service_role");
}

async function expectHealthyPage(page: import("@playwright/test").Page) {
  await expect(page.locator("body")).not.toContainText("Application error");
  await expectNoPublicSecretLeak(await page.content());
}

async function expectReferencedScriptsLoad(
  page: import("@playwright/test").Page,
) {
  const scriptSources = await page.locator('script[src^="/_next/static/"]').evaluateAll(
    (scripts) =>
      scripts
        .map((script) => script.getAttribute("src"))
        .filter((src): src is string => Boolean(src)),
  );
  const uniqueScriptSources = Array.from(new Set(scriptSources)).slice(0, 12);

  expect(uniqueScriptSources.length).toBeGreaterThan(0);

  for (const scriptSource of uniqueScriptSources) {
    const response = await page.request.get(scriptSource);
    const contentType = response.headers()["content-type"] ?? "";

    expect(response.ok(), `${scriptSource} should load`).toBe(true);
    expect(contentType, `${scriptSource} should be JavaScript`).toMatch(
      /javascript|ecmascript/i,
    );
  }
}

test("public home renders SEO metadata and stays within a production smoke budget", async ({
  page,
}, testInfo) => {
  const requests: string[] = [];
  const successfulImageResponses: SuccessfulImageResponseEvent[] = [];
  await page.addInitScript(() => {
    type ImageResponseAttributionState = {
      collect: () => void;
      excludedSources: Set<string>;
      firstRailFullSources: Set<string>;
    };
    const attributionWindow = window as typeof window & {
      __initialImageResponseAttribution?: ImageResponseAttributionState;
    };
    const firstRailFullSources = new Set<string>();
    const excludedSources = new Set<string>();
    const getSource = (image: HTMLImageElement) => {
      const source = image.currentSrc || image.src;

      return source ? new URL(source, window.location.href).href : "";
    };
    const collect = () => {
      const firstRail = document.querySelector('[data-home-villa-rail="true"]');

      for (const image of Array.from(document.images)) {
        const source = getSource(image);

        if (!source) {
          continue;
        }

        const isFirstRailFullImage =
          firstRail !== null &&
          image.matches('[data-progressive-full]') &&
          image.closest('[data-villa-card-main-image="true"]') !== null &&
          image.closest('[data-home-villa-rail="true"]') === firstRail;

        (isFirstRailFullImage ? firstRailFullSources : excludedSources).add(source);
      }
    };

    attributionWindow.__initialImageResponseAttribution = {
      collect,
      excludedSources,
      firstRailFullSources,
    };
    new MutationObserver(collect).observe(document, {
      attributeFilter: ["data-progressive-full", "src", "srcset"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    document.addEventListener("DOMContentLoaded", collect, { once: true });
    window.requestAnimationFrame(collect);
  });
  page.on("request", (request) => requests.push(request.url()));
  const captureSuccessfulImageResponse = (response: import("@playwright/test").Response) => {
    const imageResponse = getSuccessfulImageResponse(response);

    if (imageResponse) {
      successfulImageResponses.push(imageResponse);
    }
  };
  page.on("response", captureSuccessfulImageResponse);

  const response = await page.goto("/", { waitUntil: "networkidle" });
  page.off("response", captureSuccessfulImageResponse);

  expect(response?.ok()).toBe(true);
  expect(
    requests.filter((url) => new URL(url).searchParams.has("_rsc")),
  ).toEqual([]);
  expect(
    requests.filter((url) => new URL(url).pathname === "/_next/image"),
  ).toEqual([]);
  expect(
    requests.filter((url) => new URL(url).pathname === "/api/home-sections"),
  ).toEqual([]);
  expect(
    requests.filter((url) => new URL(url).pathname === "/api/houses"),
  ).toEqual([]);
  await expectHealthyPage(page);
  await expectReferencedScriptsLoad(page);
  await expect.poll(() => page.title()).not.toBe("");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /พูล|villa|บ้าน/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  const initialDocumentHtml = await response?.text();
  expect(
    initialDocumentHtml?.match(/data-villa-card-main-image="true"/g) ?? [],
  ).toHaveLength(4);

  const { excludedImageSources, firstRailFullImageSources } = await page.evaluate(() => {
    const attributionWindow = window as typeof window & {
      __initialImageResponseAttribution?: {
        collect: () => void;
        excludedSources: Set<string>;
        firstRailFullSources: Set<string>;
      };
    };
    const attribution = attributionWindow.__initialImageResponseAttribution;

    attribution?.collect();
    return {
      excludedImageSources: Array.from(attribution?.excludedSources ?? []),
      firstRailFullImageSources: Array.from(
        attribution?.firstRailFullSources ?? [],
      ),
    };
  });
  const initialFullCoverResponses = selectFirstRailFullImageResponseEvents({
    excludedImageSources,
    firstRailFullImageSources,
    responses: successfulImageResponses,
  });

  expect(firstRailFullImageSources.length).toBeGreaterThan(0);
  expect(initialFullCoverResponses.length).toBeLessThanOrEqual(4);

  const navigationDuration = await page.evaluate(() => {
    const [navigationEntry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];

    return navigationEntry?.duration ?? 0;
  });

  expect(navigationDuration).toBeGreaterThan(0);
  expect(navigationDuration).toBeLessThan(maxNavigationDurationMs);

  const mobileSearch = page.locator('[data-home-mobile-search="true"]');
  const isMobileProject =
    testInfo.project.use?.isMobile ??
    (typeof testInfo.project.use?.viewport?.width === "number"
      ? testInfo.project.use.viewport.width <= 768
      : false);

  if (isMobileProject) {
    await expect(mobileSearch).toBeVisible();
    await expect(
      mobileSearch.getByRole("button", { name: /^ค้นหา$/i }),
    ).toBeVisible();
  } else {
    await expect(mobileSearch).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /ค้นหาบ้านพัก/i }).first(),
    ).toBeVisible();
  }

  const bodyUserSelect = await page.locator("body").evaluate((element) => {
    return getComputedStyle(element).userSelect;
  });

  expect(bodyUserSelect).not.toBe("none");
});

test("search page renders, and a live villa detail page renders when listing data is available", async ({
  page,
}) => {
  const searchResponse = await page.goto("/search", { waitUntil: "networkidle" });

  expect(searchResponse?.ok()).toBe(true);
  await expectHealthyPage(page);

  const detailLinks = page.locator('a[href^="/villas/"]');
  const detailLinkCount = await detailLinks.count();

  if (detailLinkCount === 0) {
    return;
  }

  const detailHref = await detailLinks.first().getAttribute("href");

  expect(detailHref).toMatch(/^\/villas\/[^/]+$/);

  const detailResponse = await page.goto(detailHref ?? "/search", {
    waitUntil: "domcontentloaded",
  });

  expect(detailResponse?.ok()).toBe(true);
  await expectHealthyPage(page);
});

test("admin routes keep unauthenticated users on login and expose theme vars", async ({
  page,
}) => {
  await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expectHealthyPage(page);
  await expect(page.locator('input[type="email"]')).toBeVisible();

  const themeVars = await page.locator("main").evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      accent: style.getPropertyValue("--site-accent").trim(),
      primary: style.getPropertyValue("--site-primary").trim(),
      surface: style.getPropertyValue("--site-surface").trim(),
      text: style.getPropertyValue("--site-text").trim(),
    };
  });

  expect(Object.values(themeVars).every(Boolean)).toBe(true);
});
