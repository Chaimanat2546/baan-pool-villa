import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, getHttpsOrigin } from "../csp";

function getCspDirective(csp: string, name: string): string {
  return (
    csp.split("; ").find((directive) => directive.startsWith(`${name} `)) ?? ""
  );
}

describe("content security policy", () => {
  it("adds a request nonce and allows Next Image inline styles", () => {
    const csp = buildContentSecurityPolicy({
      isDevelopment: false,
      nonce: "request-nonce",
      supabaseUrl: "https://example.supabase.co/rest/v1",
    });
    const styleSrc = getCspDirective(csp, "style-src");
    const scriptSrc = getCspDirective(csp, "script-src");
    const imgSrc = getCspDirective(csp, "img-src");
    const connectSrc = getCspDirective(csp, "connect-src");

    expect(styleSrc).toContain("'self'");
    expect(styleSrc).toContain("'unsafe-inline'");
    expect(styleSrc).toContain("https://fonts.googleapis.com");
    expect(styleSrc).toContain("'nonce-request-nonce'");
    expect(scriptSrc).toContain("'nonce-request-nonce'");
    expect(scriptSrc).toContain("https://challenges.cloudflare.com");
    expect(scriptSrc).toContain("https://static.cloudflareinsights.com");
    expect(imgSrc).toContain(
      "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws",
    );
    expect(imgSrc).toContain("https://devillegroups.com");
    expect(imgSrc).toContain("https://www.devillegroups.com");
    expect(imgSrc).toContain("https://webook-media.poolvilla.workers.dev");
    expect(imgSrc).toContain("https://s3.ap-southeast-1.amazonaws.com");
    expect(connectSrc).toContain("https://example.supabase.co");
    expect(connectSrc).toContain("https://static.cloudflareinsights.com");
    expect(connectSrc.split(" ")).not.toContain("https:");
    expect(getCspDirective(csp, "style-src-attr")).toBe(
      "style-src-attr 'unsafe-inline'",
    );
  });

  it("keeps invalid public origins out of connect-src", () => {
    const csp = buildContentSecurityPolicy({
      isDevelopment: false,
      supabaseUrl: "javascript:alert(1)",
    });

    expect(getCspDirective(csp, "connect-src")).not.toContain("javascript:");
  });

  it("allows local websocket and eval sources only in development", () => {
    const csp = buildContentSecurityPolicy({
      isDevelopment: true,
      supabaseUrl: undefined,
    });
    const scriptSrc = getCspDirective(csp, "script-src");
    const connectSrc = getCspDirective(csp, "connect-src");

    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(connectSrc).toContain("ws:");
    expect(connectSrc).toContain("wss:");
  });

  it("normalizes only https origins", () => {
    expect(getHttpsOrigin("https://example.com/path?q=1")).toBe(
      "https://example.com",
    );
    expect(getHttpsOrigin("http://example.com")).toBeNull();
    expect(getHttpsOrigin("not a url")).toBeNull();
  });
});
