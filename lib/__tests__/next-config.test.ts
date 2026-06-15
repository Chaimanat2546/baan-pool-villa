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
          key: "Content-Security-Policy",
          value: expect.stringContaining("frame-ancestors 'none'"),
        }),
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
        },
      ]),
    );
  });

  it("allows Cloudflare Turnstile scripts and frames through the global CSP", async () => {
    const headers = await nextConfig.headers?.();
    const csp = headers
      ?.find((entry) => entry.source === "/:path*")
      ?.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value;
    const scriptSrc = getCspDirective(csp, "script-src");

    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("https://challenges.cloudflare.com");
    expect(scriptSrc.split(" ")).not.toContain("https:");
    expect(csp).toContain(
      "frame-src 'self' https://challenges.cloudflare.com",
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
