import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

loadEnvConfig(process.cwd());
const id = "10000000-0000-4000-8000-000000000001";
const imageId = "20000000-0000-4000-8000-000000000001";
const project = new URL(
  process.env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL ??
    "https://test.supabase.co",
).hostname.split(".")[0];
const token = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated", exp: 4102444800 })).toString("base64url")}.test-signature`;

test.beforeEach(async ({ page }) => {
  // Synthetic browser session and intercepted APIs; never writes to real CMS/Auth.
  await page.addInitScript(
    ({ key, accessToken, userId }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: accessToken,
          refresh_token: "test-refresh",
          expires_at: 4102444800,
          token_type: "bearer",
          user: { id: userId, aud: "authenticated", role: "authenticated" },
        }),
      );
    },
    { key: `sb-${project}-auth-token`, accessToken: token, userId: id },
  );
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { state: "active" } }),
  );
  await page.route("**/auth/v1/**", (route) =>
    route.fulfill({
      json: {
        id,
        user: { id },
        access_token: token,
        refresh_token: "test-refresh",
        expires_in: 31536000,
      },
    }),
  );
  await page.route("**/api/analytics/v1/events", (route) =>
    route.fulfill({ status: 201, json: { status: "stored" } }),
  );
});

test("site advertisement editor keeps uploads local and preserves failed saves", async ({
  page,
}, testInfo) => {
  let saves = 0;
  let ad = {
    id,
    title: "ล่องเรือชมพระอาทิตย์ตกและกิจกรรมสำหรับครอบครัวในวันหยุด",
    zone: "all",
    sortOrder: 0,
    isActive: true,
    updatedAt: "2026-10-20T12:00:00Z",
    images: [
      {
        id: imageId,
        storagePath: `${id}/${imageId}.webp`,
        url: "/images/villa-card-preview-cover.png",
      },
    ],
  };
  await page.route("**/api/admin/advertisements**", async (route) => {
    if (route.request().method() === "POST") {
      saves++;
      if (saves === 1)
        return route.fulfill({
          status: 403,
          json: {
            error: "อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง",
            code: "storage_error",
          },
        });
      const request = route.request();
      const form = await new Request(request.url(), {
        method: "POST",
        headers: { "Content-Type": request.headers()["content-type"] },
        body: new Uint8Array(request.postDataBuffer()!),
      }).formData();
      const draft = JSON.parse(String(form.get("advertisement")));
      ad = {
        ...ad,
        title: draft.title,
        images: draft.images.map((image: { id?: string }, index: number) => ({
          id: image.id ?? `30000000-0000-4000-8000-00000000000${index}`,
          storagePath: "",
          url: "/images/villa-card-preview-cover.png",
        })),
      };
      return route.fulfill({
        json: { id, updatedAt: ad.updatedAt, images: ad.images, warnings: [] },
      });
    }
    return route.fulfill({
      json: { advertisements: [ad, { ...ad, id: "10000000-0000-4000-8000-000000000002", title: "บริการรถรับส่งสนามบิน", zone: "pattaya", isActive: false, images: [] }], total: 2, page: 1, pageSize: 20 },
    });
  });
  await page.goto("/admin/advertisements");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "จัดการโฆษณา", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "รายการโฆษณา" })).toBeVisible();
  await expect(page.getByRole("button", { name: "เพิ่มโฆษณา", exact: true })).toBeEnabled();
  await expect(page.locator("form")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("advertisement-table.png"), fullPage: true });
  await page.getByRole("button", { name: `แก้ไขโฆษณา ${ad.title}`, exact: true }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue(ad.title);
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("advertisements-desktop-or-mobile.png"),
    fullPage: true,
  });
  await page.locator('input[name="title"]').fill("กิจกรรมที่กำหนดเอง");
  await page
    .getByLabel("เพิ่มรูปโฆษณา")
    .setInputFiles(path.resolve("public/images/villa-card-preview-1.jpg"));
  expect(saves).toBe(0);
  await expect(page.getByText("ยังไม่อัปโหลด", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "เลื่อนรูป 2 ขึ้น", exact: true })
    .click();
  await page.getByRole("button", { name: "บันทึกโฆษณา", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "ดำเนินการไม่สำเร็จ" }),
  ).toBeVisible();
  await expect(page.locator('input[name="title"]')).toHaveValue(
    "กิจกรรมที่กำหนดเอง",
  );
  expect(page.url()).toContain("/admin/advertisements");
  await page.getByRole("button", { name: "บันทึกโฆษณา", exact: true }).click();
  await expect(
    page.getByText("บันทึกโฆษณาแล้ว", { exact: true }),
  ).toBeVisible();
  expect(saves).toBe(2);
  await expect(page.getByText("ยังไม่อัปโหลด", { exact: false })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("กิจกรรมที่กำหนดเอง");
});

test("editing twelve images keeps save in reach on every screen", async ({ page, isMobile }, testInfo) => {
  const ad = {
    id,
    title: "กิจกรรมสำหรับครอบครัวและกลุ่มเพื่อน พร้อมบริการล่องเรือชมพระอาทิตย์ตก",
    zone: "all", isActive: true, sortOrder: 0, updatedAt: "2026-10-20T12:00:00Z",
    images: Array.from({ length: 12 }, (_, index) => ({
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      url: "/images/villa-card-preview-cover.png", storagePath: "",
    })),
  };
  await page.route("**/api/admin/advertisements**", route => route.fulfill({
    json: { advertisements: [ad], total: 1 },
  }));
  await page.goto("/admin/advertisements");
  await expect(page.locator("form")).toHaveCount(0);
  await page.getByRole("button", { name: `แก้ไขโฆษณา ${ad.title}`, exact: true }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue(ad.title);
  const save = page.getByRole("button", { name: "บันทึกโฆษณา", exact: true });
  await expect(save).toBeInViewport();
  await expect(page.getByRole("complementary", { name: "ตัวอย่างโฆษณา" })).toHaveCount(0);
  if (!isMobile) {
    for (const width of [1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const form = await page.locator("form").boundingBox();
      expect(form!.width).toBeLessThanOrEqual(920);
      await expect(save).toBeInViewport();
    }
  }
  const thumbnail = await page.getByRole("img", { name: "รูปโฆษณาที่ 1", exact: true }).boundingBox();
  expect(thumbnail!.width).toBeLessThanOrEqual(140);
  expect(thumbnail!.height).toBeLessThanOrEqual(90);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await expect(save).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("twelve-images-editor.png"), fullPage: true });
  await page.locator('input[name="title"]').fill("ยังไม่บันทึก");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue("ยังไม่บันทึก");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await expect(page.getByRole("table")).toContainText(ad.title);
});

test("empty and database-error states remain usable", async ({ page }) => {
  let error = false;
  await page.route("**/api/admin/advertisements**", (route) =>
    route.fulfill(
      error
        ? {
            status: 500,
            json: { error: "โหลดโฆษณาไม่สำเร็จ กรุณาติดตั้งฐานข้อมูล" },
          }
        : { json: { advertisements: [], total: 0 } },
    ),
  );
  await page.goto("/admin/advertisements");
  await expect(page.getByText("ยังไม่มีโฆษณา", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "เพิ่มโฆษณา", exact: true }).click();
  await expect(page.locator('input[name="title"]')).toBeVisible();
  await expect(page.getByText("เพิ่มรูปอย่างน้อย 1 รูป", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  error = true;
  await page.getByRole("button", { name: "โหลดใหม่", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "โหลดโฆษณาไม่สำเร็จ" }),
  ).toBeVisible();
  expect(page.url()).toContain("/admin/advertisements");
});

test("table pagination returns to the previous page after deleting its last record", async ({ page }) => {
  const records = Array.from({ length: 21 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `กิจกรรม ${index + 1}`, zone: "all", isActive: true,
    sortOrder: index, updatedAt: "2026-10-20T12:00:00Z", images: [],
  }));
  let deletedId: string | undefined;
  await page.route("**/api/admin/advertisements**", async route => {
    if (route.request().method() === "DELETE") {
      deletedId = route.request().postDataJSON().id;
      records.pop();
      return route.fulfill({ json: { warnings: [] } });
    }
    const currentPage = Number(new URL(route.request().url()).searchParams.get("page"));
    return route.fulfill({ json: { advertisements: records.slice((currentPage - 1) * 20, currentPage * 20), total: records.length } });
  });
  await page.goto("/admin/advertisements");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(21);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "แก้ไขโฆษณา กิจกรรม 21", exact: true }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "ลบโฆษณา", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(21);
  await expect(page.getByRole("table")).not.toContainText("กิจกรรม 21");
  await expect(page.locator("form")).toHaveCount(0);
  expect(deletedId).toBe("40000000-0000-4000-8000-000000000021");
});

test("public detail keeps document navigation and bounded image/API requests", async ({
  page,
}, testInfo) => {
  await page.goto("/search", { waitUntil: "networkidle" });
  const link = page.locator('a[href^="/villas/"]').first();
  test.skip(
    (await link.count()) === 0,
    "No live catalog villa is available for a network check",
  );
  const href = await link.getAttribute("href");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const response = await page.goto(href!, { waitUntil: "networkidle" });
  expect(response?.ok()).toBe(true);
  await expect(page.locator("body")).not.toContainText("Application error");
  expect(
    requests.filter((url) => new URL(url).searchParams.has("_rsc")),
  ).toHaveLength(0);
  expect(
    requests.filter((url) => new URL(url).pathname === "/_next/image"),
  ).toHaveLength(0);
  expect(
    requests.filter((url) => /webook-media.*\/advertisements\//.test(url)),
  ).toHaveLength(0);
  const apiRequests = requests.filter((url) =>
    new URL(url).pathname.startsWith("/api/"),
  );
  const dataRequests = apiRequests.filter(
    (url) => !new URL(url).pathname.includes("image"),
  );
  expect(dataRequests.length).toBeLessThanOrEqual(6);
  expect(apiRequests.length).toBeLessThanOrEqual(40);
  await page.screenshot({
    path: testInfo.outputPath("public-detail.png"),
    fullPage: true,
  });
});
