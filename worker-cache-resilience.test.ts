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
import {
  createSuspiciousListingRequestEvent,
  logSuspiciousListingRequest,
} from "./worker-listing-security-log.js";
import worker from "./worker.js";

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "caches",
);

function request(path: string) {
  return new Request(`https://tenant.example${path}`);
}

function cloudflareRequest(
  path: string,
  init: RequestInit,
  cf: Record<string, unknown>,
) {
  const result = new Request(`https://tenant.example${path}`, init);

  Object.defineProperty(result, "cf", {
    configurable: true,
    value: cf,
  });

  return result;
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

describe("Worker suspicious listing request logs", () => {
  it.each([
    ["/", "home_page"],
    ["/search?zone=jomtien", "villa_search_page"],
    ["/villas/42", "villa_detail_page"],
    ["/api/home-sections", "home_sections_api"],
    ["/api/home-deferred?after=hero", "home_deferred_api"],
    ["/sitemap.xml", "villa_sitemap"],
  ])("classifies suspicious listing access to %s", (path, routeKind) => {
    const automatedRequest = cloudflareRequest(
      path,
      { headers: { "User-Agent": "curl/8.12.1" } },
      {},
    );

    expect(
      createSuspiciousListingRequestEvent(
        automatedRequest,
        new Response("ok"),
      ),
    ).toEqual(
      expect.objectContaining({
        pathname: new URL(automatedRequest.url).pathname,
        reasons: ["automated_user_agent"],
        routeKind,
      }),
    );
  });

  it.each([
    ["/search/", "villa_search_page"],
    ["/villas/42/", "villa_detail_page"],
    ["/api/houses/", "villa_catalog_api"],
    ["/api/home-sections/", "home_sections_api"],
    ["/api/home-deferred/", "home_deferred_api"],
    ["/api/villas/42/", "villa_detail_api"],
    ["/sitemap.xml/", "villa_sitemap"],
  ])("classifies the trailing-slash listing route %s", (path, routeKind) => {
    const event = createSuspiciousListingRequestEvent(
      cloudflareRequest(
        path,
        { headers: { "User-Agent": "curl/8.12.1" } },
        {},
      ),
      new Response("ok"),
    );

    expect(event).toEqual(expect.objectContaining({ routeKind }));
  });

  it("emits a numeric villa id for filtering and aggregation", () => {
    const event = createSuspiciousListingRequestEvent(
      cloudflareRequest(
        "/api/villas/42",
        { headers: { "User-Agent": "curl/8.12.1" } },
        {},
      ),
      new Response("ok"),
    );

    expect(event).toEqual(expect.objectContaining({ villaId: 42 }));
  });

  it.each([
    ["GET", null, ["missing_user_agent"]],
    [
      "HEAD",
      "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
      ["listing_api_access"],
    ],
  ])(
    "handles the %s User-Agent boundary without false method alerts",
    (method, userAgent, expectedReasons) => {
      const headers = userAgent ? { "User-Agent": userAgent } : undefined;
      const event = createSuspiciousListingRequestEvent(
        cloudflareRequest("/api/houses", { headers, method }, {}),
        new Response(null, { status: 200 }),
      );

      if (expectedReasons) {
        expect(event).toEqual(
          expect.objectContaining({ reasons: expectedReasons }),
        );
        return;
      }

      expect(event).toBeNull();
    },
  );

  it("treats a non-read method on a listing route as suspicious", () => {
    const unexpectedMethodRequest = cloudflareRequest(
      "/api/houses",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
        },
        method: "POST",
      },
      {},
    );

    expect(
      createSuspiciousListingRequestEvent(
        unexpectedMethodRequest,
        new Response("ok"),
      ),
    ).toEqual(
      expect.objectContaining({ reasons: ["unexpected_method"] }),
    );
  });

  it("records all matching reasons and bounds untrusted metadata", () => {
    const longOrganization = `Network\u0000Operator ${"x".repeat(200)}`;
    const longUserAgent = `curl/8.12.1 ${"y".repeat(600)}`;
    const event = createSuspiciousListingRequestEvent(
      cloudflareRequest(
        "/api/houses",
        { headers: { "User-Agent": longUserAgent }, method: "POST" },
        { asOrganization: longOrganization },
      ),
      new Response("limited", { status: 429 }),
    );

    expect(event).toEqual(
      expect.objectContaining({
        asOrganization: expect.not.stringContaining("\u0000"),
        reasons: [
          "automated_user_agent",
          "unexpected_method",
          "http_error",
        ],
      }),
    );
    expect(event?.asOrganization).toHaveLength(160);
    expect(event?.userAgent).toHaveLength(512);
  });

  it("does not classify an unsafe numeric villa id", () => {
    const event = createSuspiciousListingRequestEvent(
      cloudflareRequest(
        "/api/villas/9007199254740992",
        { headers: { "User-Agent": "curl/8.12.1" } },
        {},
      ),
      new Response("not found", { status: 404 }),
    );

    expect(event).toBeNull();
  });

  it("logs the Cloudflare client IP and network for automated catalog access without sensitive request data", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(
        new Response('{"items":[]}', {
          headers: { "Content-Type": "application/json" },
        }),
      ),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const suspiciousRequest = cloudflareRequest(
      "/api/houses?page=1&token=must-not-appear",
      {
        headers: {
          Authorization: "Bearer must-not-appear",
          "CF-Connecting-IP": "203.0.113.42",
          "CF-Ray": "9abcdef012345678-BKK",
          "CF-Worker": "scraper.example",
          Cookie: "session=must-not-appear",
          "User-Agent": "Go-http-client/1.1",
        },
      },
      {
        asn: 13335,
        asOrganization: "Cloudflare, Inc.",
        colo: "BKK",
        country: "TH",
      },
    );

    const response = await worker.fetch(suspiciousRequest, {}, context());

    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      "UA: Go-http-client/1.1 | IP: 203.0.113.42 | ASN: AS13335 | ISP: Cloudflare, Inc. | Country: TH | Colo: BKK | Host: tenant.example | Method: GET | Path: /api/houses | Route: villa_catalog_api | Status: 200 | Cache: BYPASS | Ray: 9abcdef012345678-BKK | Reason: automated_user_agent | CF-Worker: scraper.example",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("must-not-appear");
  });

  it("logs failed listing responses even when the user agent looks like a browser", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    workerMocks.openNextFetch.mockResolvedValue(
      new Response("upstream unavailable", { status: 503 }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failedRequest = cloudflareRequest(
      "/api/villas/42",
      {
        headers: {
          "CF-Connecting-IP": "198.51.100.7",
          "User-Agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
        },
      },
      {
        asn: 45758,
        asOrganization: "Triple T Internet",
        colo: "BKK",
        country: "TH",
      },
    );

    const response = await worker.fetch(failedRequest, {}, context());

    expect(response.status).toBe(503);
    expect(warn).toHaveBeenCalledWith(
      "UA: Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 | IP: 198.51.100.7 | ASN: AS45758 | ISP: Triple T Internet | Country: TH | Colo: BKK | Host: tenant.example | Method: GET | Path: /api/villas/42 | Route: villa_detail_api | Status: 503 | Cache: BYPASS | Ray: - | Reason: http_error | CF-Worker: -",
    );
  });

  it("logs successful browser catalog access so a scripted browser UA cannot bypass visibility", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response('{"items":[]}')),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await worker.fetch(
      cloudflareRequest(
        "/api/houses",
        {
          headers: {
            "CF-Connecting-IP": "192.0.2.9",
            "User-Agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
          },
        },
        {
          asn: 17552,
          asOrganization: "True Internet Corporation Co., Ltd.",
          colo: "BKK",
          country: "TH",
        },
      ),
      {},
      context(),
    );

    expect(warn).toHaveBeenCalledWith(
      "UA: Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 | IP: 192.0.2.9 | ASN: AS17552 | ISP: True Internet Corporation Co., Ltd. | Country: TH | Colo: BKK | Host: tenant.example | Method: GET | Path: /api/houses | Route: villa_catalog_api | Status: 200 | Cache: HIT | Ray: - | Reason: listing_api_access | CF-Worker: -",
    );
  });

  it("does not log automated requests outside listing data routes", async () => {
    const cache = {
      match: vi.fn(),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await worker.fetch(
      cloudflareRequest(
        "/robots.txt",
        {
          headers: {
            "CF-Connecting-IP": "203.0.113.15",
            "User-Agent": "curl/8.12.1",
          },
        },
        {
          asn: 64500,
          asOrganization: "Example Network",
          colo: "BKK",
          country: "TH",
        },
      ),
      {},
      context(),
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it("logs sanitized client context when a listing request throws", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    workerMocks.openNextFetch.mockRejectedValue(
      new Error("upstream secret=must-not-appear"),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failedRequest = cloudflareRequest(
      "/api/houses",
      {
        headers: {
          "CF-Connecting-IP": "198.51.100.11",
          "User-Agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
        },
      },
      {
        asn: 45629,
        asOrganization: "Jasmine Internet Co., Ltd.",
        colo: "BKK",
        country: "TH",
      },
    );

    await expect(
      worker.fetch(failedRequest, {}, context()),
    ).rejects.toThrow("upstream secret=must-not-appear");
    expect(warn).toHaveBeenCalledWith(
      "UA: Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 | IP: 198.51.100.11 | ASN: AS45629 | ISP: Jasmine Internet Co., Ltd. | Country: TH | Colo: BKK | Host: tenant.example | Method: GET | Path: /api/houses | Route: villa_catalog_api | Status: - | Cache: - | Ray: - | Reason: upstream_exception | CF-Worker: -",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("must-not-appear");
  });

  it("preserves a successful listing response when the console logger throws", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response('{"items":[]}')),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("logger unavailable");
    });

    const response = await worker.fetch(
      cloudflareRequest(
        "/api/houses",
        { headers: { "User-Agent": "curl/8.12.1" } },
        {},
      ),
      {},
      context(),
    );

    expect(response.status).toBe(200);
  });

  it("preserves the original listing exception when the console logger throws", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(),
    };
    setDefaultCache(cache);
    workerMocks.openNextFetch.mockRejectedValue(new Error("origin failure"));
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("logger unavailable");
    });

    await expect(
      worker.fetch(
        cloudflareRequest(
          "/api/houses",
          {
            headers: {
              "User-Agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
            },
          },
          {},
        ),
        {},
        context(),
      ),
    ).rejects.toThrow("origin failure");
  });

  it("does not throw when direct event logging fails", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("logger unavailable");
    });
    const suspiciousRequest = cloudflareRequest(
      "/api/houses",
      { headers: { "User-Agent": "curl/8.12.1" } },
      {},
    );

    expect(() =>
      logSuspiciousListingRequest(suspiciousRequest, new Response("ok")),
    ).not.toThrow();
  });
});
