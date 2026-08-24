import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("OpenNext incremental cache configuration", () => {
  it("keeps regional cache hits from refreshing R2 in the background", async () => {
    const source = await readFile("open-next.config.ts", "utf8");

    expect(source).toContain(
      'from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"',
    );
    expect(source).toMatch(
      /incrementalCache:\s*withRegionalCache\(r2IncrementalCacheWithDiagnostics,\s*\{\s*mode:\s*"long-lived"/,
    );
    expect(source).toMatch(/shouldLazilyUpdateOnCacheHit:\s*false/);
    expect(source).toContain(
      'from "./open-next-r2-incremental-cache-diagnostics.js"',
    );
    expect(source).not.toContain("bypassTagCacheOnCacheHit: true");
  });
});
