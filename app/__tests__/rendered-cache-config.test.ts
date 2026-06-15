import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROUTE_FILES_WITHOUT_RENDERED_CACHE = [
  "app/(public)/(home)/page.tsx",
  "app/(public)/guides/page.tsx",
  "app/(public)/guides/[slug]/page.tsx",
  "app/(public)/villas/[id]/page.tsx",
] as const;

const DYNAMIC_DETAIL_ROUTE_FILES = [
  "app/(public)/guides/[slug]/page.tsx",
  "app/(public)/villas/[id]/page.tsx",
] as const;

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("rendered page cache route config", () => {
  it("renders the root app shell on demand without forcing data fetches no-store", () => {
    const rootLayout = readProjectFile("app/layout.tsx");

    expect(rootLayout).toMatch(/export\s+const\s+revalidate\s*=\s*0\s*;/);
    expect(rootLayout).not.toMatch(
      /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
    );
    expect(rootLayout).not.toMatch(
      /export\s+const\s+fetchCache\s*=\s*["']force-no-store["']/,
    );
  });

  it("does not keep per-page rendered ISR config on public pages", () => {
    ROUTE_FILES_WITHOUT_RENDERED_CACHE.forEach((path) => {
      const source = readProjectFile(path);

      expect(source).not.toMatch(/export\s+const\s+revalidate\s*=/);
      expect(source).not.toMatch(
        /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/,
      );
      expect(source).not.toMatch(
        /export\s+const\s+fetchCache\s*=\s*["']force-no-store["']/,
      );
    });
  });

  it("does not prebuild dynamic detail pages with generateStaticParams", () => {
    DYNAMIC_DETAIL_ROUTE_FILES.forEach((path) => {
      const source = readProjectFile(path);

      expect(source).not.toMatch(/export\s+async\s+function\s+generateStaticParams/);
    });
  });

  it("caches sitemap.xml at the route level while leaving data helper caches in place", () => {
    const sitemap = readProjectFile("app/sitemap.ts");
    const nextConfig = readProjectFile("next.config.ts");

    expect(sitemap).toMatch(
      /import\s+type\s*\{\s*SitemapRevalidateSeconds\s*\}\s+from\s+["']@\/lib\/cache-policy["']\s*;/,
    );
    expect(sitemap).toMatch(
      /export\s+const\s+revalidate\s*:\s*SitemapRevalidateSeconds\s*=\s*86400\s*;/,
    );
    expect(sitemap).not.toMatch(/export\s+const\s+revalidate\s*=\s*0\s*;/);
    expect(nextConfig).toContain('source: "/sitemap.xml"');
    expect(nextConfig).toContain(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    );
  });

  it("marks admin pages and admin APIs as no-store", () => {
    const nextConfig = readProjectFile("next.config.ts");

    expect(nextConfig).toContain('source: "/admin/:path*"');
    expect(nextConfig).toContain('source: "/api/admin/:path*"');
    expect(nextConfig).toContain('value: "no-store"');
  });
});
