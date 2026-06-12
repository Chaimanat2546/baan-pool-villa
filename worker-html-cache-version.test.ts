import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  HTML_CACHE_VERSION_STORAGE_PREFIX,
  clearHtmlCacheVersionMemoryCache,
  getHtmlEdgeCacheVersionToken,
  writeHtmlEdgeCacheVersions,
} from "./worker-html-cache-version.js";

function createKvStore(values: Record<string, string> = {}) {
  return {
    get: vi.fn(async (key: string) => values[key] ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values[key] = value;
    }),
  };
}

function createR2Store(values: Record<string, string> = {}) {
  return {
    get: vi.fn(async (key: string) => {
      const value = values[key];

      return value
        ? {
            text: async () => value,
          }
        : null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      values[key] = value;
    }),
  };
}

describe("worker HTML cache versions", () => {
  beforeEach(() => {
    clearHtmlCacheVersionMemoryCache();
  });

  it("builds a stable version token from KV when the KV binding is available", async () => {
    const kv = createKvStore({
      [`${HTML_CACHE_VERSION_STORAGE_PREFIX}guides`]: "guide-v2",
      [`${HTML_CACHE_VERSION_STORAGE_PREFIX}site-settings`]: "settings-v4",
    });

    await expect(
      getHtmlEdgeCacheVersionToken(
        { BPV_HTML_CACHE_VERSIONS: kv },
        ["site-settings", "guides"],
        1_000,
      ),
    ).resolves.toBe("site-settings:settings-v4|guides:guide-v2");
  });

  it("falls back to the OpenNext R2 cache bucket when no KV binding exists", async () => {
    const r2 = createR2Store({
      [`${HTML_CACHE_VERSION_STORAGE_PREFIX}legal-pages`]: "legal-v3",
    });

    await expect(
      getHtmlEdgeCacheVersionToken(
        { NEXT_INC_CACHE_R2_BUCKET: r2 },
        ["legal-pages"],
        1_000,
      ),
    ).resolves.toBe("legal-pages:legal-v3");
  });

  it("uses zero versions when no version store is configured", async () => {
    await expect(
      getHtmlEdgeCacheVersionToken({}, ["site-settings", "guides"], 1_000),
    ).resolves.toBe("site-settings:0|guides:0");
  });

  it("keeps version reads in isolate memory for a short window", async () => {
    const kv = createKvStore({
      [`${HTML_CACHE_VERSION_STORAGE_PREFIX}guides`]: "guide-v2",
    });

    await getHtmlEdgeCacheVersionToken(
      { BPV_HTML_CACHE_VERSIONS: kv },
      ["guides"],
      1_000,
    );
    await getHtmlEdgeCacheVersionToken(
      { BPV_HTML_CACHE_VERSIONS: kv },
      ["guides"],
      2_000,
    );

    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  it("writes new versions to KV and clears the in-memory copy", async () => {
    const kv = createKvStore({
      [`${HTML_CACHE_VERSION_STORAGE_PREFIX}guides`]: "old",
    });

    await getHtmlEdgeCacheVersionToken(
      { BPV_HTML_CACHE_VERSIONS: kv },
      ["guides"],
      1_000,
    );
    await writeHtmlEdgeCacheVersions(
      { BPV_HTML_CACHE_VERSIONS: kv },
      ["guides"],
      "new",
    );

    expect(kv.put).toHaveBeenCalledWith(
      `${HTML_CACHE_VERSION_STORAGE_PREFIX}guides`,
      "new",
    );
    await expect(
      getHtmlEdgeCacheVersionToken(
        { BPV_HTML_CACHE_VERSIONS: kv },
        ["guides"],
        2_000,
      ),
    ).resolves.toBe("guides:new");
  });
});
