import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next image config", () => {
  it("serves images directly without using the Next image optimizer", () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
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

    expect(csp).toContain("script-src");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain(
      "frame-src 'self' https://challenges.cloudflare.com",
    );
  });
});
