import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Never submit synthetic analytics or advertising hits to a real backend.
  await page.route("**/api/analytics/v1/events", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"status":"stored"}',
    }),
  );
  await page.route(
    /https:\/\/.*(googletagmanager|google-analytics|googleadservices|doubleclick)\.com\//,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      }),
  );
});

test("counts without consent, identifying headers, storage or Google tags", async ({
  page,
  context,
}, testInfo) => {
  const events: Record<string, unknown>[] = [];
  const headers: Record<string, string>[] = [];
  const google: string[] = [];
  await context.addCookies([
    {
      name: "unrelated-session",
      value: "private-cookie",
      url: testInfo.project.use.baseURL as string,
    },
  ]);
  await page.route("**/api/analytics/v1/events", async (route) => {
    events.push(route.request().postDataJSON());
    headers.push(await route.request().allHeaders());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"status":"stored"}',
    });
  });
  page.on("request", (r) => {
    if (
      /googletagmanager|google-analytics|googleadservices|doubleclick/.test(
        r.url(),
      )
    )
      google.push(r.url());
  });
  await page.goto("/privacy?email=private@example.test#private");
  await expect.poll(() => events.length).toBe(1);
  await expect(
    page.getByRole("heading", { name: "สถิติแบบไม่ติดตามบุคคล" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ยอมรับ", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "ตั้งค่าความเป็นส่วนตัว", exact: true }),
  ).toHaveCount(0);
  expect(events[0]).toMatchObject({
    event_name: "page_view",
    page_path: "/privacy",
    villa_id: null,
    channel: null,
  });
  expect(Object.keys(events[0]).sort()).toEqual([
    "channel",
    "event_id",
    "event_name",
    "page_path",
    "schema_version",
    "villa_id",
  ]);
  expect(headers[0].cookie).toBeUndefined();
  expect(headers[0].referer).toBeUndefined();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(google).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("nontracking-privacy.png"),
    fullPage: true,
  });
  await page.reload();
  await expect.poll(() => events.length).toBe(2);
  expect(events[1].event_id).not.toBe(events[0].event_id);
});

test("analytics emits one page view per document and excludes 404/admin", async ({
  page,
}) => {
  const events: Record<string, unknown>[] = [];
  const unexpected: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/analytics/v1/events"))
      events.push(r.postDataJSON());
    if (r.url().includes("_rsc=") || r.url().includes("/_next/image"))
      unexpected.push(r.url());
  });
  await page.goto("/privacy");
  await expect.poll(() => events.length).toBe(1);
  await page.evaluate(() =>
    history.replaceState(null, "", "/privacy?filter=test#text"),
  );
  expect(events).toHaveLength(1);
  await page.goto("/terms");
  await expect.poll(() => events.length).toBe(2);
  await page.goto("/no-such-analytics-page");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/admin/login");
  await page.waitForLoadState("domcontentloaded");
  expect(events).toHaveLength(2);
  expect(unexpected).toHaveLength(0);
});

test("legacy ads consent never loads Google tags", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "bpv.tracking-consent",
      JSON.stringify({
        version: 1,
        analytics: false,
        ads: true,
        expiresAt: Date.now() + 86400000,
      }),
    ),
  );
  const requests: string[] = [];
  page.on("request", (r) => {
    if (
      /googletagmanager|google-analytics|googleadservices|doubleclick/.test(
        r.url(),
      )
    )
      requests.push(r.url());
  });
  await page.goto("/privacy");
  await expect(
    page.getByRole("button", { name: "ตั้งค่าความเป็นส่วนตัว", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  expect(requests).toHaveLength(0);
  expect(
    await page.evaluate(
      () =>
        typeof (window as typeof window & { dataLayer?: unknown[] }).dataLayer,
    ),
  ).toBe("undefined");
});
