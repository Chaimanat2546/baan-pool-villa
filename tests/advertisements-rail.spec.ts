import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Test-only component bundle; the real public route gets a separate production network check.
const fixture = build({
  entryPoints: ["tests/support/advertisements-rail-fixture.tsx"], bundle: true, write: false,
  outdir: "unused-test-output", format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_AWS_IMAGE_LOADER_BASE_URL": "undefined" },
  plugins: [{ name: "fixture-image", setup(builder) {
    builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "jsx", resolveDir: process.cwd(), contents: `
      import {forwardRef} from 'react';
      export default forwardRef(function Image({fill,loader,quality,preload,unoptimized,src,...props},ref) {
        return <img {...props} ref={ref} src={loader ? loader({src,width:320,quality}) : src}
          style={fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : undefined} />;
      });` }));
  } }],
});

for (const brokenImages of [false, true]) {
test(`public advertisement rail shows three desktop cards and loads the ninth on demand${brokenImages ? " after image failures" : ""}`, async ({ page, isMobile }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const output = (await fixture).outputFiles;
  const script = output.find(file => file.path.endsWith(".js"))!.text;
  const cssDir = path.resolve(".next/static/css");
  const css = readdirSync(cssDir, { recursive: true }).filter(file => String(file).endsWith(".css")).map(file => readFileSync(path.join(cssDir, String(file)), "utf8")).join("\n") + output.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n");
  await page.route("**/__advertisements_fixture", route => route.fulfill({ contentType: "text/html", body: `<html lang="th"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><style>:root {--site-primary:#087f72;--site-on-primary:#fff;--site-border:#dde5e2;--site-surface:#fff;--site-surface-soft:#f5f7f6;--site-surface-tint:#eef3f1;--site-text:#183c35;--site-muted:#667970;--site-header-link:#fff}body{margin:0;background:#f5f7f6;font-family:sans-serif}</style><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></html>` }));
  await page.route("**/api/advertisements/images/**", route => {
    const imageId = new URL(route.request().url()).pathname.split("/").at(-1);
    return brokenImages && ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002"].includes(imageId!)
      ? route.fulfill({ status: 404 })
      : route.fulfill({ path: "public/images/villa-card-preview-1.jpg", contentType: "image/jpeg" });
  });
  let pages = 0;
  await page.route(/\/api\/advertisements\?/, route => {
    pages++;
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("zone")).toBe("pattaya");
    expect(params.get("after")).toBe("7:10000000-0000-4000-8000-000000000008");
    const imageUrl = "/api/advertisements/images/20000000-0000-4000-8000-000000000009";
    return route.fulfill({ json: { advertisements: [{ id: "10000000-0000-4000-8000-000000000009", title: "กิจกรรม 9", imageUrl, imageUrls: [imageUrl] }], nextCursor: null } });
  });
  await page.goto("/__advertisements_fixture");
  const cards = page.locator("[data-detail-advertisement-card]");
  await expect(cards).toHaveCount(brokenImages ? 6 : 8);
  expect(pages).toBe(0);
  const viewport = page.locator("[data-scroll-rail-viewport]");
  const shown = await viewport.evaluate(node => {
    const view = node.getBoundingClientRect();
    return Array.from(node.querySelectorAll("[data-detail-advertisement-card]")).filter(card => {
      const box = card.getBoundingClientRect(); return box.left >= view.left - 1 && box.right <= view.right + 1;
    }).length;
  });
  expect(shown).toBe(isMobile ? 1 : 3);
  await page.screenshot({ path: testInfo.outputPath("rail-initial.png"), fullPage: true });
  if (!isMobile) {
    await page.locator("#root > div").evaluate(node => { (node as HTMLElement).style.width = "360px"; });
    await expect.poll(async () => (await cards.first().boundingBox())!.width).toBeGreaterThanOrEqual(200);
    await page.screenshot({ path: testInfo.outputPath("rail-narrow-column.png"), fullPage: true });
    await page.locator("#root > div").evaluate(node => { (node as HTMLElement).style.width = "auto"; });
  }
  const bounds = (await viewport.boundingBox())!;
  const beforeDrag = await viewport.locator(":scope > div").getAttribute("style");
  await page.mouse.move(bounds.x + bounds.width - 20, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 200, bounds.y + 80, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => viewport.locator(":scope > div").getAttribute("style")).not.toBe(beforeDrag);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (let index = 0; index < (isMobile ? 8 : 6); index++) {
    await page.getByRole("button", { name: "เลื่อนโฆษณาไปทางขวา", exact: true }).click();
  }
  await expect(cards).toHaveCount(brokenImages ? 7 : 9);
  await expect(cards.last().getByRole("img")).toBeVisible();
  await cards.last().click();
  expect(errors).toEqual([]);
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.width).toBe(page.viewportSize()!.width);
  expect(dialog!.height).toBe(page.viewportSize()!.height);
  expect(pages).toBe(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("rail-ninth-gallery.png"), fullPage: true });
});
}
