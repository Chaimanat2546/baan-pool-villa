import { expect, test } from "@playwright/test";

const maxNavigationDurationMs = 15_000;

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
  const response = await page.goto("/", { waitUntil: "networkidle" });

  expect(response?.ok()).toBe(true);
  await expectHealthyPage(page);
  await expectReferencedScriptsLoad(page);
  await expect.poll(() => page.title()).not.toBe("");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /พูล|villa|บ้าน/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

  const navigationDuration = await page.evaluate(() => {
    const [navigationEntry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];

    return navigationEntry?.duration ?? 0;
  });

  expect(navigationDuration).toBeGreaterThan(0);
  expect(navigationDuration).toBeLessThan(maxNavigationDurationMs);
  await expect(page.getByRole("button", { name: /ค้นหาบ้านพัก/i }).first()).toBeVisible();

  const mobileSearch = page.locator('[data-home-mobile-search="true"]');
  const isMobileProject =
    testInfo.project.use?.isMobile ??
    (typeof testInfo.project.use?.viewport?.width === "number"
      ? testInfo.project.use.viewport.width <= 768
      : false);

  if (isMobileProject) {
    await expect(mobileSearch).toBeVisible();
  } else {
    await expect(mobileSearch).not.toBeVisible();
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
    waitUntil: "networkidle",
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
