import { expect, test } from "@playwright/test";

const maxNavigationDurationMs = 15_000;

async function expectNoPublicSecretLeak(html: string) {
  await expect(html).not.toContain("DEVILLE_BEARER_TOKEN");
  await expect(html).not.toContain("SUPABASE_SERVICE_ROLE");
  await expect(html).not.toContain("service_role");
}

test("public home renders SEO metadata and stays within a production smoke budget", async ({
  page,
}, testInfo) => {
  const response = await page.goto("/", { waitUntil: "networkidle" });

  expect(response?.ok()).toBe(true);
  await expect(page.locator("body")).not.toContainText("Application error");
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

  if (testInfo.project.name === "mobile-chromium") {
    await expect(mobileSearch).toBeVisible();
  } else {
    await expect(mobileSearch).not.toBeVisible();
  }

  const bodyUserSelect = await page.locator("body").evaluate((element) => {
    return getComputedStyle(element).userSelect;
  });

  expect(bodyUserSelect).not.toBe("none");
  await expectNoPublicSecretLeak(await page.content());
});

test("search page and villa detail route render without runtime errors", async ({
  page,
}) => {
  for (const path of ["/search", "/villas/9"]) {
    const response = await page.goto(path, { waitUntil: "networkidle" });

    expect(response?.ok()).toBe(true);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expectNoPublicSecretLeak(await page.content());
  }
});

test("admin routes keep unauthenticated users on login and expose theme vars", async ({
  page,
}) => {
  await page.goto("/admin/settings", { waitUntil: "networkidle" });

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.locator("body")).not.toContainText("Application error");
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
  await expectNoPublicSecretLeak(await page.content());
});
