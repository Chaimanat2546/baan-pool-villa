import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("bumpHtmlEdgeCacheVersions", () => {
  it("awaits the version write even when scheduling it with waitUntil", async () => {
    const { writeHtmlEdgeCacheVersionGroupsForContext } = await import(
      "./html-edge-cache-version"
    );
    const waitUntil = vi.fn();
    let finishWrite: (() => void) | undefined;
    const writePromise = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const kv = {
      put: vi.fn(() => writePromise),
    };

    let settled = false;
    const bumpPromise = writeHtmlEdgeCacheVersionGroupsForContext({
      ctx: { waitUntil },
      env: { BPV_HTML_CACHE_VERSIONS: kv },
      groups: ["site-settings"],
      version: "test-version",
    }).then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    expect(settled).toBe(false);

    finishWrite?.();
    await bumpPromise;

    expect(settled).toBe(true);
  });
});
