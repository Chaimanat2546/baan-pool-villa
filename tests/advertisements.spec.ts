import { test, expect } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { buildSiteThemeStyle } from "@/lib/site-settings/colors";

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
  page, isMobile,
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
      .getByRole("heading", { name: /จัดการโฆษณา/ }),
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "รายการโฆษณา" })).toBeVisible();
  await expect(page.getByRole("button", { name: "เพิ่มโฆษณา", exact: true })).toBeEnabled();
  await expect(page.locator('form[aria-label="ฟอร์มโฆษณา"]' )).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: "เลือกไฟล์หรือลากรูปมาวาง", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("เพิ่มรูปโฆษณา")).toBeDisabled();
  if (!isMobile) {
    const localImage = await page.getByRole("img", { name: "รูปโฆษณาที่ 2", exact: true }).getAttribute("src");
    for (const toggle of ["ย่อแถบเมนูหลังบ้าน", "ขยายแถบเมนูหลังบ้าน"]) {
      await page.getByRole("button", { name: toggle, exact: true }).click();
      await expect(page.locator('input[name="title"]')).toHaveValue("กิจกรรมที่กำหนดเอง");
      await expect(page.getByRole("img", { name: "รูปโฆษณาที่ 2", exact: true })).toHaveAttribute("src", localImage!);
      await expect(page.getByText("ยังไม่อัปโหลด", { exact: true })).toBeVisible();
      expect(saves).toBe(0);
    }
  }
  await page
    .getByRole("button", { name: "เลือกรูปที่ 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "เลื่อนรูปไปก่อนหน้า", exact: true })
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
    page.getByText("บันทึกแล้ว", { exact: true }),
  ).toBeVisible();
  expect(saves).toBe(2);
  await expect(page.getByText("ยังไม่อัปโหลด", { exact: false })).toHaveCount(
    0,
  );
  await expect(page.getByText("บันทึกแล้ว", { exact: true })).toHaveCount(0, { timeout: 6000 });
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("กิจกรรมที่กำหนดเอง");
});

test("editor accepts dropped files locally and uploads only on save", async ({ page }, testInfo) => {
  let saves = 0;
  let images = [{ id: imageId, storagePath: `${id}/${imageId}.webp`, url: "/images/villa-card-preview-3.jpg" }];
  await page.route("**/api/admin/advertisements**", async route => {
    if (route.request().method() === "POST") {
      saves++;
      const request = route.request();
      const form = await new Request(request.url(), { method: "POST", headers: { "Content-Type": request.headers()["content-type"] }, body: new Uint8Array(request.postDataBuffer()!) }).formData();
      expect(form.getAll("images")).toHaveLength(1);
      const draft = JSON.parse(String(form.get("advertisement")));
      expect(draft.images).toEqual([{ id: imageId }, { uploadIndex: 0 }]);
      images = [...images, { id: "30000000-0000-4000-8000-000000000001", storagePath: "", url: "/images/villa-card-preview-3.jpg" }];
      return route.fulfill({ json: { id, updatedAt: "2026-10-20T12:00:01Z", images, warnings: [] } });
    }
    return route.fulfill({ json: { advertisements: [{ id, title: "รูปโฆษณาแบบลากวาง", zone: "all", sortOrder: 0, isActive: true, updatedAt: "2026-10-20T12:00:00Z", images }], total: 1 } });
  });
  await page.goto("/admin/advertisements");
  await page.getByRole("button", { name: "แก้ไขโฆษณา รูปโฆษณาแบบลากวาง", exact: true }).click();
  const area = page.locator('section[aria-label="รูปโฆษณา"]');
  const feedback = page.locator('form[aria-label="ฟอร์มโฆษณา"]' ).getByRole("alert");
  await expect(page.getByRole("button", { name: "เลือกไฟล์หรือลากรูปมาวาง", exact: true })).toBeVisible();
  const invalid = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["<svg/>"], "invalid.svg", { type: "image/svg+xml" }));
    return data;
  });
  await area.dispatchEvent("drop", { dataTransfer: invalid });
  await expect(feedback).toContainText("รูปต้องเป็น JPG, PNG หรือ WebP");
  const valid = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zp4sAAAAASUVORK5CYII="), character => character.charCodeAt(0));
    data.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    return data;
  });
  await area.dispatchEvent("dragenter", { dataTransfer: valid });
  await area.dispatchEvent("dragover", { dataTransfer: valid });
  await page.screenshot({ path: testInfo.outputPath("file-drop-zone.png"), fullPage: true });
  await area.dispatchEvent("drop", { dataTransfer: valid });
  await expect(area.getByRole("img")).toHaveCount(2);
  await expect(feedback).toHaveCount(0);
  await expect(page.getByText("ยังไม่อัปโหลด", { exact: true })).toBeVisible();
  expect(saves).toBe(0);
  await area.dispatchEvent("drop", { dataTransfer: valid });
  await expect(feedback).toContainText("เลือกรูปได้สูงสุด 2 รูป");
  await expect(area.getByRole("img")).toHaveCount(2);
  expect(saves).toBe(0);
  await page.getByRole("button", { name: "บันทึกโฆษณา", exact: true }).click();
  await expect(page.getByText("บันทึกแล้ว", { exact: true })).toBeVisible();
  await expect(page.getByText("ยังไม่อัปโหลด", { exact: true })).toHaveCount(0);
  expect(saves).toBe(1);
  await invalid.dispose();
  await valid.dispose();
});

test("compact editor puts save after the fields and images", async ({ page, isMobile }, testInfo) => {
  const ad = {
    id,
    title: "กิจกรรมสำหรับครอบครัวและกลุ่มเพื่อน พร้อมบริการล่องเรือชมพระอาทิตย์ตก",
    zone: "all", isActive: true, sortOrder: 0, updatedAt: "2026-10-20T12:00:00Z",
    images: Array.from({ length: 2 }, (_, index) => ({
      id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      url: "/images/villa-card-preview-cover.png", storagePath: "",
    })),
  };
  await page.route("**/api/admin/advertisements**", route => route.fulfill({
    json: { advertisements: [ad], total: 1 },
  }));
  await page.goto("/admin/advertisements");
  await expect(page.locator('form[aria-label="ฟอร์มโฆษณา"]' )).toHaveCount(0);
  if (!isMobile) {
    await page.setViewportSize({ width: 1920, height: 900 });
    for (const state of ["expanded", "collapsed"]) {
      const workspace = await page.getByRole("main").locator(":scope > div").boundingBox();
      const sidebar = await page.locator(`[data-admin-sidebar-state="${state}"]`).boundingBox();
      expect(workspace!.width).toBeLessThanOrEqual(1280);
      expect(Math.abs(workspace!.x + workspace!.width / 2 - (1920 + sidebar!.width) / 2)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`table-${state}.png`), fullPage: true });
      await page.getByRole("button", { name: state === "expanded" ? "ย่อแถบเมนูหลังบ้าน" : "ขยายแถบเมนูหลังบ้าน", exact: true }).click();
    }
  }
  await page.getByRole("button", { name: `แก้ไขโฆษณา ${ad.title}`, exact: true }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue(ad.title);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  const visibility = page.getByRole("switch", { name: "เปิดแสดงบนเว็บไซต์", exact: true });
  await expect(visibility).toBeChecked();
  await visibility.focus();
  await page.keyboard.press("Space");
  await expect(visibility).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(visibility).toBeChecked();
  const save = page.getByRole("button", { name: "บันทึกโฆษณา", exact: true });
  await expect(page.locator('form[aria-label="ฟอร์มโฆษณา"] > footer').getByRole("button", { name: "บันทึกโฆษณา", exact: true })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "ตัวอย่างโฆษณา" })).toHaveCount(0);
  if (!isMobile) {
    for (const [width, height] of [[1024, 768], [1366, 768], [1920, 900], [2560, 1080]]) {
      await page.setViewportSize({ width, height });
      for (const state of ["expanded", "collapsed"]) {
        const sidebar = await page.locator(`[data-admin-sidebar-state="${state}"]`).boundingBox();
        const form = await page.locator('form[aria-label="ฟอร์มโฆษณา"]' ).boundingBox();
        expect(form!.width).toBeLessThanOrEqual(840);
        expect(Math.abs(form!.x + form!.width / 2 - (width + sidebar!.width) / 2)).toBeLessThanOrEqual(1);
        await expect(save).toBeInViewport({ ratio: 1 });
        const fields = await page.locator("fieldset").boundingBox();
        expect((await save.boundingBox())!.y).toBeGreaterThanOrEqual(fields!.y + fields!.height);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (width === 1366 || width === 1920) await page.screenshot({ path: testInfo.outputPath(`editor-${width}-${state}.png`), fullPage: true });
        await page.getByRole("button", { name: state === "expanded" ? "ย่อแถบเมนูหลังบ้าน" : "ขยายแถบเมนูหลังบ้าน", exact: true }).click();
      }
    }
  }
  const thumbnail = await page.getByRole("img", { name: "รูปโฆษณาที่ 1", exact: true }).boundingBox();
  expect(thumbnail!.width).toBeLessThanOrEqual(140);
  expect(thumbnail!.height).toBeLessThanOrEqual(90);
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("two-images-editor.png"), fullPage: true });
  await page.locator('form[aria-label="ฟอร์มโฆษณา"] > footer').screenshot({ path: testInfo.outputPath("form-actions.png") });
  await page.locator('input[name="title"]').fill("ยังไม่บันทึก");
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 720 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "ละทิ้งการแก้ไข?" })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "แก้ไขต่อ", exact: true }).click();
  await expect(page.locator('input[name="title"]')).toHaveValue("ยังไม่บันทึก");
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ละทิ้งการแก้ไข", exact: true }).click();
  await expect(page.getByRole("table")).toContainText(ad.title);
  if (!isMobile) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole("button", { name: "ย่อแถบเมนูหลังบ้าน", exact: true }).click();
    await page.reload();
    await expect(page.locator('[data-admin-sidebar-state="collapsed"]')).toBeVisible();
    await page.getByRole("button", { name: "เพิ่มโฆษณา", exact: true }).click();
    await expect(page.getByRole("heading", { name: "เพิ่มโฆษณา", exact: true })).toBeVisible();
    for (const state of ["collapsed", "expanded"]) {
      const sidebar = await page.locator(`[data-admin-sidebar-state="${state}"]`).boundingBox();
      const form = await page.locator('form[aria-label="ฟอร์มโฆษณา"]' ).boundingBox();
      expect(Math.abs(form!.x + form!.width / 2 - (1366 + sidebar!.width) / 2)).toBeLessThanOrEqual(1);
      await expect(save).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath(`create-${state}.png`), fullPage: true });
      if (state === "collapsed") await page.getByRole("button", { name: "ขยายแถบเมนูหลังบ้าน", exact: true }).click();
    }
  }
});

test("mobile advertisements keep filters, image uploads and actions usable at narrow widths", async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, "Mobile touch layout");
  const title = "กิจกรรมสำหรับครอบครัวและกลุ่มเพื่อนพร้อมบริการล่องเรือชมพระอาทิตย์ตก";
  await page.route("**/api/admin/advertisements**", route => route.fulfill({ json: {
    advertisements: [{ id, title, zone: "all", isActive: true, sortOrder: 0, updatedAt: "2026-10-20T12:00:00Z", images: [{ id: imageId, storagePath: "", url: "/images/villa-card-preview-cover.png" }] }], total: 9,
  } }));
  await page.goto("/admin/advertisements");
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    for (const control of [page.getByRole("searchbox"), page.getByRole("combobox", { name: "โซน", exact: true }), page.getByRole("button", { name: "ค้นหา", exact: true }), page.getByRole("button", { name: "ถัดไป", exact: true })]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const zone = await page.getByRole("combobox", { name: "โซน", exact: true }).boundingBox();
    const status = await page.getByRole("combobox", { name: "สถานะ", exact: true }).boundingBox();
    expect(zone!.y).toBe(status!.y);
    await expect(page.getByRole("table")).toContainText("เปิดแสดง");
    await expect.poll(fits).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`mobile-list-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: `แก้ไขโฆษณา ${title}`, exact: true }).click();
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    const titleControl = page.locator('input[name="title"]');
    const save = page.getByRole("button", { name: "บันทึกโฆษณา", exact: true });
    expect((await titleControl.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await save.boundingBox())!.width).toBeGreaterThanOrEqual(160);
    const image = await page.getByRole("button", { name: "เลือกรูปที่ 1", exact: true }).boundingBox();
    const upload = await page.getByRole("button", { name: "เลือกไฟล์หรือลากรูปมาวาง", exact: true }).boundingBox();
    expect(Math.abs(image!.y - upload!.y)).toBeLessThanOrEqual(1);
    await expect.poll(fits).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`mobile-editor-${width}.png`), fullPage: true });
  }
  await page.locator('input[name="title"]').fill("ร่างบนมือถือ");
  await page.getByRole("button", { name: "เปิดเมนูหลังบ้าน", exact: true }).click();
  await page.getByRole("button", { name: "ปิดเมนูหลังบ้าน", exact: true }).last().click();
  await expect(page.locator('input[name="title"]')).toHaveValue("ร่างบนมือถือ");
});

test("website confirmation modals preserve drafts, trap focus and confirm navigation and deletion", async ({ page, isMobile }, testInfo) => {
  const nativeDialogs: string[] = [];
  page.on("dialog", async dialog => { nativeDialogs.push(dialog.type()); await dialog.dismiss(); });
  let deletes = 0;
  await page.route("**/api/admin/**", route => route.fulfill({ status: route.request().url().endsWith("/session") ? 200 : 503, json: route.request().url().endsWith("/session") ? { state: "active" } : { error: "ข้อมูลปลายทางยังไม่พร้อม" } }));
  const title = "กิจกรรมสำหรับครอบครัวพร้อมบริการล่องเรือและเดินทางท่องเที่ยว";
  await page.route("**/api/admin/advertisements**", route => {
    if (route.request().method() === "DELETE") {
      deletes++;
      return route.fulfill({ status: 403, json: { error: "ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง", code: "storage_error" } });
    }
    return route.fulfill({ json: { advertisements: [{ id, title, zone: "all", sortOrder: 0, isActive: true, updatedAt: "2026-10-20T12:00:00Z", images: [{ id: imageId, url: "/images/villa-card-preview-cover.png", storagePath: "" }] }], total: 1 } });
  });
  await page.setViewportSize({ width: isMobile ? 320 : 1366, height: 768 });
  await page.goto("/admin/advertisements");
  await page.getByRole("button", { name: `แก้ไขโฆษณา ${title}`, exact: true }).click();
  const draftTitle = "ร่างที่ยังไม่บันทึก " + "กิจกรรม".repeat(12);
  await page.locator('input[name="title"]').fill(draftTitle);
  await page.getByLabel("เพิ่มรูปโฆษณา").setInputFiles(path.resolve("public/images/villa-card-preview-1.jpg"));
  const localImage = await page.getByRole("img", { name: "รูปโฆษณาที่ 2", exact: true }).getAttribute("src");
  const back = page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true });
  await back.click();
  const discard = page.getByRole("alertdialog", { name: "ละทิ้งการแก้ไข?", exact: true });
  await expect(discard).toBeVisible();
  await expect(discard.getByRole("button", { name: "แก้ไขต่อ", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(discard.getByRole("button", { name: "ละทิ้งการแก้ไข", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(discard.getByRole("button", { name: "แก้ไขต่อ", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(discard.getByRole("button", { name: "ละทิ้งการแก้ไข", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(discard.getByRole("button", { name: "แก้ไขต่อ", exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("discard-modal.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(discard).toHaveCount(0);
  await expect(back).toBeFocused();
  await expect(page.locator('input[name="title"]')).toHaveValue(draftTitle);
  await expect(page.getByRole("img", { name: "รูปโฆษณาที่ 2", exact: true })).toHaveAttribute("src", localImage!);
  const remove = page.getByRole("button", { name: "ลบโฆษณา", exact: true });
  await remove.click();
  const deletion = page.getByRole("alertdialog", { name: "ลบโฆษณานี้?", exact: true });
  await expect(deletion).toContainText(draftTitle);
  await page.screenshot({ path: testInfo.outputPath("delete-modal.png"), fullPage: true });
  expect(deletes).toBe(0);
  await deletion.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  await expect(remove).toBeFocused();
  expect(deletes).toBe(0);
  await remove.click();
  await deletion.getByRole("button", { name: "ลบโฆษณา", exact: true }).click();
  await expect(page.getByRole("region", { name: "ข้อผิดพลาดในการจัดการโฆษณา", exact: true })).toBeFocused();
  expect(deletes).toBe(1);
  await expect(page.locator('input[name="title"]')).toHaveValue(draftTitle);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  if (isMobile) {
    await page.getByRole("button", { name: "เปิดเมนูหลังบ้าน", exact: true }).click();
    await page.locator('a[href="/admin/sections"]:visible').click();
  } else await page.getByRole("link", { name: "ตั้งชื่อหัวข้อและตำแหน่งในหน้ารายละเอียด", exact: true }).click();
  const leave = page.getByRole("alertdialog", { name: "ออกจากหน้านี้?", exact: true });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "ออกจากหน้านี้", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(isMobile ? "/admin/sections$" : "/admin/detail-layout$"));
  if (isMobile) await expect(page.getByRole("button", { name: "ปิดเมนูหลังบ้าน", exact: true })).toHaveCount(0);
  expect(nativeDialogs).toEqual([]);
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
  const records = Array.from({ length: 9 }, (_, index) => ({
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
    return route.fulfill({ json: { advertisements: records.slice((currentPage - 1) * 8, currentPage * 8), total: records.length } });
  });
  await page.goto("/admin/advertisements");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(9);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "แก้ไขโฆษณา กิจกรรม 9", exact: true }).click();
  await page.getByRole("button", { name: "ลบโฆษณา", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ลบโฆษณา", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(9);
  await expect(page.getByRole("table")).not.toContainText("กิจกรรม 9");
  await expect(page.locator('form[aria-label="ฟอร์มโฆษณา"]' )).toHaveCount(0);
  expect(deletedId).toBe("40000000-0000-4000-8000-000000000009");
});

test("admin navigation stays readable with pale primary colors", async ({ page, isMobile }, testInfo) => {
  await page.route("**/api/admin/advertisements**", route => route.fulfill({ json: { advertisements: [], total: 0 } }));
  await page.goto("/admin/advertisements");
  await expect(page.getByRole("table")).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "เปิดเมนูหลังบ้าน", exact: true }).click();
  const selected = page.locator('nav:visible a[aria-current="page"]');
  await expect(selected).toHaveCount(1);
  const geometry = await page.getByRole("main").boundingBox();
  for (const primary of ["#ffffff", "#fef9c3", "#ffb000", "#ff0000", "#064e3b"]) {
    const theme = buildSiteThemeStyle({ primaryColor: primary, accentColor: "#eab308" });
    await page.addStyleTag({ content: `.site-theme { ${Object.entries(theme).map(([key, value]) => `${key}:${value} !important`).join(";")} } .site-theme * { transition: none !important; }` });
    const inherited = await page.getByRole("main").evaluate(main => {
      const css = getComputedStyle(main);
      return Object.fromEntries(["--site-text", "--site-surface-soft", "--site-surface-tint", "--site-border", "--site-border-strong"].map(key => [key, css.getPropertyValue(key).trim()]));
    });
    for (const [key, value] of Object.entries(inherited)) expect(value).toBe(theme[key as keyof typeof theme]);
    const rgb = primary.slice(1).match(/../g)!.map(channel => Number.parseInt(channel, 16));
    await expect(selected).toHaveCSS("background-color", `rgb(${rgb.join(", ")})`);
    expect(await page.getByRole("main").boundingBox()).toEqual(geometry);
    const contrast = await selected.evaluate(link => {
      const style = getComputedStyle(link);
      const context = document.createElement("canvas").getContext("2d")!;
      function luminance(color: string) {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const rgb = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      }
      const text = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    if (["#ffb000", "#ff0000", "#064e3b"].includes(primary)) {
      await page.screenshot({ path: testInfo.outputPath(`theme-${primary.slice(1)}.png`), fullPage: true });
    }
  }
  if (isMobile) {
    await page.getByRole("button", { name: "ปิดเมนูหลังบ้าน", exact: true }).last().click();
    await expect(page.locator('nav:visible')).toHaveCount(0);
  } else {
    await page.getByRole("button", { name: "ย่อแถบเมนูหลังบ้าน", exact: true }).click();
    const sidebar = page.locator('[data-admin-sidebar-state="collapsed"]');
    await expect(sidebar).toBeVisible();
    const logout = sidebar.getByRole("button", { name: "ออกจากระบบ", exact: true });
    await expect(logout).toBeInViewport({ ratio: 1 });
    expect((await logout.boundingBox())!.height).toBeLessThanOrEqual(48);
    const collapsedGeometry = await page.getByRole("main").boundingBox();
    const yellow = buildSiteThemeStyle({ primaryColor: "#ffb000", accentColor: "#eab308" });
    await page.addStyleTag({ content: `.site-theme { ${Object.entries(yellow).map(([key, value]) => `${key}:${value} !important`).join(";")} }` });
    await expect(selected).toHaveCSS("background-color", "rgb(255, 176, 0)");
    expect(await page.getByRole("main").boundingBox()).toEqual(collapsedGeometry);
    await page.screenshot({ path: testInfo.outputPath("theme-yellow-collapsed.png"), fullPage: true });
  }
});

test("editor table filters search the database and preserve eight-item pagination", async ({ page }, testInfo) => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: index === 11 ? "บริการรถรับส่ง" : `เรือ ${index + 1}`,
    zone: index === 10 ? "jomtien" : "pattaya", isActive: index !== 9,
    sortOrder: index, updatedAt: "2026-10-20T12:00:00Z", images: [{ id: imageId, storagePath: "", url: "/images/villa-card-preview-cover.png" }],
  }));
  const queries: URLSearchParams[] = [];
  await page.route("**/api/admin/advertisements**", async route => {
    if (route.request().method() === "POST") {
      const request = route.request();
      const form = await new Request(request.url(), { method: "POST", headers: { "Content-Type": request.headers()["content-type"] }, body: new Uint8Array(request.postDataBuffer()!) }).formData();
      const draft = JSON.parse(String(form.get("advertisement")));
      const record = records.find(ad => ad.id === draft.id)!;
      record.isActive = draft.isActive;
      return route.fulfill({ json: { id: record.id, updatedAt: record.updatedAt, images: record.images, warnings: [] } });
    }
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    const filtered = records.filter(ad => (!params.get("search") || ad.title.includes(params.get("search")!)) && (!params.get("zone") || ad.zone === params.get("zone")) && (params.get("status") !== "active" || ad.isActive));
    const start = (Number(params.get("page")) - 1) * 8;
    return route.fulfill({ json: { advertisements: filtered.slice(start, start + 8), total: filtered.length } });
  });
  await page.goto("/admin/advertisements");
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(9);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("searchbox", { name: "ค้นหาชื่อโฆษณา" }).fill("เรือ");
  await page.getByRole("combobox", { name: "โซน", exact: true }).selectOption("pattaya");
  await page.getByRole("combobox", { name: "สถานะ", exact: true }).selectOption("active");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.getByText("หน้า 1 / 2", { exact: true })).toBeVisible();
  expect(Object.fromEntries(queries.at(-1)!)).toEqual({ page: "1", search: "เรือ", zone: "pattaya", status: "active" });
  await page.screenshot({ path: testInfo.outputPath("filtered-table.png"), fullPage: true });
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  expect(queries.at(-1)?.get("search")).toBe("เรือ");
  await page.getByRole("button", { name: "แก้ไขโฆษณา เรือ 9", exact: true }).click();
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await expect(page.getByText("หน้า 2 / 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("เรือ");
  await page.getByRole("button", { name: "แก้ไขโฆษณา เรือ 9", exact: true }).click();
  await page.getByRole("switch", { name: "เปิดแสดงบนเว็บไซต์", exact: true }).uncheck();
  await page.getByRole("button", { name: "บันทึกโฆษณา", exact: true }).click();
  await expect(page.getByText("บันทึกแล้ว", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "กลับรายการโฆษณา", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(9);
  await expect(page.getByRole("table")).not.toContainText("เรือ 9");
  expect(queries.at(-1)?.get("page")).toBe("1");
  expect(queries.at(-1)?.get("status")).toBe("active");
  await page.getByRole("searchbox").fill("ไม่พบรายการ");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.getByText("ไม่พบโฆษณาที่ตรงกับการค้นหา", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ล้าง", exact: true }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(9);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await expect(page.getByRole("heading", { name: "ไม่พบบ้านพักนี้", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-detail-layout-block]").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
  const activities = page.locator("[data-detail-advertisement-card]");
  if (await activities.count() > 1) {
    const first = (await activities.nth(0).boundingBox())!;
    const second = (await activities.nth(1).boundingBox())!;
    expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
    expect(second.y).toBeGreaterThan(first.y + first.height);
  }
  const activity = activities.first();
  if (await activity.count()) {
    await activity.click();
    const gallery = page.getByRole("dialog");
    await expect(gallery).toBeVisible();
    expect((await gallery.boundingBox())!.width).toBe(page.viewportSize()!.width);
    await page.getByRole("button", { name: "ปิดแกลเลอรี", exact: true }).click();
    await expect(gallery).toHaveCount(0);
  }
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
