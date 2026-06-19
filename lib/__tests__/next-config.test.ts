import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next image config", () => {
  it("serves images directly without using the Next image optimizer", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  it("keeps the fallback image optimizer cache at one year", () => {
    expect(nextConfig.images?.minimumCacheTTL).toBe(60 * 60 * 24 * 365);
  });

  it("sets global browser security headers", async () => {
    const headers = await nextConfig.headers?.();
    const globalHeaders = headers?.find((entry) => entry.source === "/:path*")
      ?.headers;

    expect(globalHeaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        }),
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ]),
    );
  });

  it("sets route-specific cache headers for sitemap and admin surfaces", async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          headers: [
            {
              key: "Cache-Control",
              value:
                "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
            },
          ],
          source: "/sitemap.xml",
        }),
        expect.objectContaining({
          headers: [{ key: "Cache-Control", value: "no-store" }],
          source: "/admin/:path*",
        }),
        expect.objectContaining({
          headers: [{ key: "Cache-Control", value: "no-store" }],
          source: "/api/admin/:path*",
        }),
      ]),
    );
  });
});
