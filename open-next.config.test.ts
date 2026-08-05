import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("OpenNext incremental cache configuration", () => {
  it("wraps the R2 incremental cache in the long-lived regional cache", async () => {
    const source = await readFile("open-next.config.ts", "utf8");

    expect(source).toContain(
      'from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"',
    );
    expect(source).toMatch(
      /incrementalCache:\s*withRegionalCache\(r2IncrementalCacheWithDiagnostics,\s*\{\s*mode:\s*"long-lived"/s,
    );
    expect(source).toContain(
      'from "./open-next-r2-incremental-cache-diagnostics.js"',
    );
    expect(source).not.toContain("bypassTagCacheOnCacheHit: true");
  });
});
