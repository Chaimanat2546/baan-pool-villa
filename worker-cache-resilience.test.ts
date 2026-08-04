import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class WorkerEntrypoint {},
}));

const workerMocks = vi.hoisted(() => ({
  calendarAccess: vi.fn(),
  htmlVersionToken: vi.fn(),
  openNextFetch: vi.fn(),
}));

vi.mock("./.open-next/worker.js", () => ({
  BucketCachePurge: class BucketCachePurge {},
  DOQueueHandler: class DOQueueHandler {},
  DOShardedTagCache: class DOShardedTagCache {},
  default: { fetch: workerMocks.openNextFetch },
}));
vi.mock("./worker-calendar-access.js", () => ({
  handleBookingCalendarAccess: workerMocks.calendarAccess,
}));
vi.mock("./worker-html-cache-version.js", () => ({
  getHtmlEdgeCacheVersionToken: workerMocks.htmlVersionToken,
}));

import {
  runCacheRead,
  scheduleCacheWrite,
} from "./worker-cache-resilience.js";
import worker from "./worker.js";

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "caches",
);

function request(path: string) {
  return new Request(`https://tenant.example${path}`);
}

function context() {
  return { waitUntil: vi.fn() };
}

function setDefaultCache(cache: { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> }) {
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: cache },
    writable: true,
  });
}

async function settleResponse(responsePromise: Promise<Response>) {
  try {
    return { ok: true as const, response: await responsePromise };
  } catch (error) {
    return { error, ok: false as const };
  }
}

beforeEach(() => {
  workerMocks.calendarAccess.mockReset();
  workerMocks.htmlVersionToken.mockReset();
  workerMocks.openNextFetch.mockReset();
  workerMocks.calendarAccess.mockResolvedValue(null);
  workerMocks.htmlVersionToken.mockResolvedValue("site-settings:1");
  workerMocks.openNextFetch.mockResolvedValue(new Response("origin"));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

afterAll(() => {
  if (originalCachesDescriptor) {
    Object.defineProperty(globalThis, "caches", originalCachesDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "caches");
});

describe("Worker cache resilience", () => {
  it("returns the cache value when the operation succeeds", async () => {
    const run = vi.fn().mockResolvedValue("cached response");

    await expect(
      runCacheRead({
        cacheKind: "html",
        operation: "match",
        routeKind: "html",
        run,
      }),
    ).resolves.toEqual({ ok: true, value: "cached response" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries a transient cache read once", async () => {
    vi.useFakeTimers();
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network connection lost"))
      .mockResolvedValueOnce("cached response");

    const resultPromise = runCacheRead({
      cacheKind: "html",
      operation: "match",
      routeKind: "html",
      run,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      value: "cached response",
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["daemonDown message", new Error("daemonDown")],
    [
      "daemonDown name",
      Object.assign(new Error("cache unavailable"), { name: "daemonDown" }),
    ],
    [
      "daemonDown code",
      Object.assign(new Error("cache unavailable"), { code: "daemonDown" }),
    ],
    [
      "daemonDown cause",
      Object.assign(new Error("cache unavailable"), {
        cause: new Error("daemonDown"),
      }),
    ],
    ["internal binding message", new Error("Cloudflare internal binding error")],
    [
      "internal binding name",
      Object.assign(new Error("cache unavailable"), {
        name: "InternalBindingError",
      }),
    ],
    [
      "internal binding code",
      Object.assign(new Error("cache unavailable"), {
        code: "INTERNAL_BINDING_ERROR",
      }),
    ],
    [
      "internal binding cause",
      Object.assign(new Error("cache unavailable"), {
        cause: new Error("Internal error in Cloudflare binding"),
      }),
    ],
  ])("retries an approved Cloudflare %s exactly once", async (_label, error) => {
    vi.useFakeTimers();
    const run = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("cached response");

    const resultPromise = runCacheRead({
      cacheKind: "html",
      operation: "match",
      routeKind: "html",
      run,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toEqual({
      ok: true,
      value: "cached response",
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("stops after one retry when daemonDown persists", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValue(new Error("daemonDown"));

    const resultPromise = runCacheRead({
      cacheKind: "json",
      operation: "match",
      routeKind: "api",
      run,
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toEqual({ ok: false });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("returns a bypass result when a cache read exceeds 1500ms", async () => {
    vi.useFakeTimers();
    const resultPromise = runCacheRead({
      cacheKind: "json",
      operation: "match",
      routeKind: "api",
      run: () => new Promise(() => undefined),
    });

    await vi.advanceTimersByTimeAsync(1500);

    await expect(resultPromise).resolves.toEqual({ ok: false });
  });

  it("does not retry permanent cache read failures", async () => {
    const run = vi.fn().mockRejectedValue(new Error("permission denied"));

    await expect(
      runCacheRead({
        cacheKind: "image",
        operation: "match",
        routeKind: "image",
        run,
      }),
    ).resolves.toEqual({ ok: false });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("logs only sanitized cache failure metadata", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await runCacheRead({
      cacheKind: "html",
      operation: "version",
      routeKind: "html",
      run: () => Promise.reject(new Error("secret cache endpoint password=unsafe")),
    });

    expect(warn).toHaveBeenCalledWith({
      attempt: 1,
      cacheKind: "html",
      errorCategory: "permanent",
      operation: "version",
      routeKind: "html",
    });
    expect(Object.keys(warn.mock.calls[0][0]).sort()).toEqual([
      "attempt",
      "cacheKind",
      "errorCategory",
      "operation",
      "routeKind",
    ]);
  });

  it("schedules a cache write that cannot reject through the request path", async () => {
    const waitUntil = vi.fn();

    scheduleCacheWrite(
      { waitUntil },
      {
        cacheKind: "json",
        operation: "put",
        routeKind: "api",
        run: () => Promise.reject(new Error("permission denied")),
      },
    );

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});

describe("Worker cache fail-open behavior", () => {
  it("turns a route-level cache timeout into BYPASS and serves OpenNext", async () => {
    vi.useFakeTimers();
    const cache = {
      match: vi.fn(() => new Promise(() => undefined)),
      put: vi.fn(),
    };
    setDefaultCache(cache);

    const responsePromise = worker.fetch(
      request("/api/houses/images/9"),
      {},
      context(),
    );

    await vi.advanceTimersByTimeAsync(1_500);
    const response = await responsePromise;

    expect(response.headers.get("x-bpv-image-cache")).toBe("BYPASS");
    expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("serves a normal HTML miss and schedules the cache write in the background", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const ctx = context();
    setDefaultCache(cache);
    workerMocks.openNextFetch.mockResolvedValue(
      new Response("<html>origin</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );

    const response = await worker.fetch(request("/guides"), {}, ctx);

    expect(response.headers.get("x-bpv-html-cache")).toBe("MISS");
    expect(await response.text()).toBe("<html>origin</html>");
    expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(ctx.waitUntil).toHaveBeenCalledTimes(1);
    await expect(ctx.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("bypasses HTML when a version read fails twice transiently", async () => {
    vi.useFakeTimers();
    const cache = {
      match: vi.fn(),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    workerMocks.htmlVersionToken
      .mockRejectedValueOnce(new Error("Network connection lost"))
      .mockRejectedValueOnce(new Error("Network connection lost"));

    const resultPromise = settleResponse(
      worker.fetch(request("/guides"), {}, context()),
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { response } = result;
    expect(response.headers.get("x-bpv-html-cache")).toBe("BYPASS");
    expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
    expect(cache.match).not.toHaveBeenCalled();
  });

  it("bypasses JSON when cache reads fail twice transiently", async () => {
    vi.useFakeTimers();
    const cache = {
      match: vi
        .fn()
        .mockRejectedValueOnce(new Error("Network connection lost"))
        .mockRejectedValueOnce(new Error("Network connection lost")),
      put: vi.fn(),
    };
    setDefaultCache(cache);

    const resultPromise = settleResponse(
      worker.fetch(request("/api/houses"), {}, context()),
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { response } = result;
    expect(response.headers.get("x-bpv-json-cache")).toBe("BYPASS");
    expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledTimes(2);
  });

  it("bypasses image requests when cache reads fail twice transiently", async () => {
    vi.useFakeTimers();
    const cache = {
      match: vi
        .fn()
        .mockRejectedValueOnce(new Error("Network connection lost"))
        .mockRejectedValueOnce(new Error("Network connection lost")),
      put: vi.fn(),
    };
    setDefaultCache(cache);

    const resultPromise = settleResponse(
      worker.fetch(
        request("/api/houses/images/9"),
        {},
        context(),
      ),
    );

    await vi.advanceTimersByTimeAsync(50);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { response } = result;
    expect(response.headers.get("x-bpv-image-cache")).toBe("BYPASS");
    expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
    expect(cache.match).toHaveBeenCalledTimes(2);
  });

  it("keeps edge cache hits on the custom image cache", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response("cached image")),
      put: vi.fn(),
    };
    setDefaultCache(cache);

    const response = await worker.fetch(
      request("/api/houses/images/9"),
      {},
      context(),
    );

    expect(response.headers.get("x-bpv-image-cache")).toBe("HIT");
    expect(workerMocks.openNextFetch).not.toHaveBeenCalled();
    expect(cache.match).toHaveBeenCalledTimes(1);
  });
});
