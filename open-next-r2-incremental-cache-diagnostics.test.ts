import { describe, expect, it } from "vitest";

import {
  createR2CacheWriteDiagnostic,
} from "./open-next-r2-incremental-cache-diagnostics.js";

describe("R2 incremental-cache diagnostics", () => {
  it("identifies a concurrent-object write without logging the cache key or raw error", () => {
    const cacheKey = "next-cache-key-that-must-not-appear-in-logs";
    const diagnostic = createR2CacheWriteDiagnostic({
      cacheKey,
      cacheType: "fetch",
      error: new Error(
        "put: Reduce your concurrent request rate for the same object. (10058)",
      ),
    });

    expect(diagnostic).toEqual({
      cacheKeyFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
      cacheType: "fetch",
      errorCode: "10058",
      errorKind: "concurrent_object_write",
      operation: "r2_incremental_cache_set",
    });
    expect(JSON.stringify(diagnostic)).not.toContain(cacheKey);
    expect(JSON.stringify(diagnostic)).not.toContain("Reduce your concurrent");
  });

  it("uses a bounded safe category for unfamiliar errors", () => {
    expect(
      createR2CacheWriteDiagnostic({
        cacheKey: "another-key",
        cacheType: undefined,
        error: new Error("upstream secret=do-not-log"),
      }),
    ).toEqual({
      cacheKeyFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/),
      cacheType: "cache",
      errorCode: "unknown",
      errorKind: "other",
      operation: "r2_incremental_cache_set",
    });
  });
});
