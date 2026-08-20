import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

function getCspDirective(csp: string | undefined, name: string): string {
  return (
    csp
      ?.split("; ")
      .find((directive) => directive.startsWith(`${name} `)) ?? ""
  );
}

describe("Next image config", () => {
  it("uses the custom image loader", () => {
    expect(nextConfig.images?.loader).toBe("custom");
    expect(nextConfig.images?.loaderFile).toBe("./lib/aws-loader.ts");
    expect(nextConfig.images?.unoptimized).toBeUndefined();
  });

  it("keeps the fallback image optimizer cache at one year", () => {
    expect(nextConfig.images?.minimumCacheTTL).toBe(60 * 60 * 24 * 365);
  });

  it("allows image qualities used by rendered image components", () => {
    expect(nextConfig.images?.qualities).toEqual([50, 60, 70, 75]);
  });

  it("allows house-card and advertisement images from the R2 worker", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hostname: "webook-media.poolvilla.workers.dev",
          pathname: "/**",
          protocol: "https",
        }),
      ]),
    );
  });

  it("sets global browser security headers", async () => {
    const headers = await nextConfig.headers?.();
    const globalHeaders = headers?.find((entry) => entry.source === "/:path*")
      ?.headers;

    expect(globalHeaders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "Content-Security-Policy",
          value: expect.stringContaining("frame-ancestors 'none'"),
        }),
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

  it("allows inline styles needed by Next Image", async () => {
    const headers = await nextConfig.headers?.();
    const csp = headers
      ?.find((entry) => entry.source === "/:path*")
      ?.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value;
    const styleSrc = getCspDirective(csp, "style-src");

    expect(styleSrc).toContain("'self'");
    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).toContain("https://fonts.googleapis.com");
    expect(getCspDirective(csp, "style-src-attr")).toBe(
      "style-src-attr 'unsafe-inline'",
    );
  });

  it("allows Google tags under the global content security policy", async () => {
    const headers = await nextConfig.headers?.();
    const csp = headers
      ?.find((entry) => entry.source === "/:path*")
      ?.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value;

    expect(getCspDirective(csp, "script-src")).toContain(
      "https://www.googletagmanager.com",
    );
    expect(getCspDirective(csp, "script-src")).toContain(
      "https://googleads.g.doubleclick.net",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://www.google-analytics.com",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://analytics.google.com",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://www.google.com",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://ad.doubleclick.net",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://googleads.g.doubleclick.net",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://www.googleadservices.com",
    );
    expect(getCspDirective(csp, "connect-src")).toContain(
      "https://www.google.co.th",
    );
    expect(getCspDirective(csp, "img-src")).toContain(
      "https://googleads.g.doubleclick.net",
    );
    expect(getCspDirective(csp, "img-src")).toContain(
      "https://www.google.com",
    );
    expect(getCspDirective(csp, "img-src")).toContain(
      "https://www.google.co.th",
    );
    expect(getCspDirective(csp, "frame-src")).toContain(
      "https://www.googletagmanager.com",
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
