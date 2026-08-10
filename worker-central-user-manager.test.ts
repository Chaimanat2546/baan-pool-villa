import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("cloudflare:workers", () => ({
  WorkerEntrypoint: class WorkerEntrypoint {
    constructor(
      public env: unknown,
      public ctx: unknown,
    ) {}
  },
}));

const workerMocks = vi.hoisted(() => ({
  calendarAccess: vi.fn(),
  cacheFunctions: {
    createHtmlEdgeCacheKey: vi.fn(),
    createHtmlEdgeVersionToken: vi.fn(),
    createJsonEdgeCacheKey: vi.fn(),
    getHtmlEdgeCacheDecision: vi.fn(),
    getImageEdgeCacheDecision: vi.fn(),
    getJsonEdgeCacheDecision: vi.fn(),
    isNextStaticAssetPath: vi.fn(),
    toHtmlEdgeCacheResponse: vi.fn(),
    toImageEdgeCacheResponse: vi.fn(),
    toJsonEdgeCacheResponse: vi.fn(),
    withHtmlEdgeCacheHeader: vi.fn(),
    withImageEdgeCacheHeader: vi.fn(),
    withJsonEdgeCacheHeader: vi.fn(),
    withStaticAssetCacheHeaders: vi.fn(),
  },
  htmlVersionToken: vi.fn(),
  openNextFetch: vi.fn(),
}));

vi.mock("./.open-next/worker.js", () => ({
  BucketCachePurge: class BucketCachePurge {},
  DOQueueHandler: class DOQueueHandler {},
  DOShardedTagCache: class DOShardedTagCache {},
  default: { fetch: workerMocks.openNextFetch },
}));
vi.mock("./worker-cache-policy.js", () => workerMocks.cacheFunctions);
vi.mock("./worker-calendar-access.js", () => ({
  handleBookingCalendarAccess: workerMocks.calendarAccess,
}));
vi.mock("./worker-html-cache-version.js", () => ({
  getHtmlEdgeCacheVersionToken: workerMocks.htmlVersionToken,
}));

import worker, { CentralUserManagerEntrypoint } from "./worker.js";
import { blockPublicCentralUserManagerRequest } from "./worker-central-user-manager.js";

const LEGACY_PATHS = [
  "/api/internal/central-user-manager/v1/health",
  "/api/internal/central-user-manager/v1/operations",
  "/api/_worker/central-user-manager",
];

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://tenant.example${path}`, init);
}

function context() {
  return { waitUntil: vi.fn() };
}

beforeEach(() => {
  workerMocks.openNextFetch.mockReset();
  workerMocks.calendarAccess.mockReset();
  workerMocks.htmlVersionToken.mockReset();
  for (const mock of Object.values(workerMocks.cacheFunctions)) {
    mock.mockReset();
  }
});

describe("Central User Manager public Worker boundary", () => {
  it.each(LEGACY_PATHS.flatMap((path) => [
    [path, "GET", undefined],
    [path, "POST", "Bearer opaque-outside-token"],
    [path, "PUT", ""],
    [path, "PATCH", "Bearer another-opaque-token"],
    [path, "DELETE", undefined],
    [path, "HEAD", "Bearer opaque-outside-token"],
    [path, "OPTIONS", undefined],
  ]))(
    "returns an empty uniform 404 for %s using %s regardless of Authorization",
    async (path, method, authorization) => {
      const headers = new Headers();
      if (authorization !== undefined) {
        headers.set("Authorization", authorization);
      }
      const response = await worker.fetch(
        request(path, {
          headers,
          method,
        }),
        {},
        context(),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(workerMocks.openNextFetch).not.toHaveBeenCalled();
      expect(workerMocks.calendarAccess).not.toHaveBeenCalled();
      expect(workerMocks.htmlVersionToken).not.toHaveBeenCalled();
      for (const mock of Object.values(workerMocks.cacheFunctions)) {
        expect(mock).not.toHaveBeenCalled();
      }
    },
  );

  it("blocks only the exact private and legacy paths", () => {
    expect(blockPublicCentralUserManagerRequest(request(LEGACY_PATHS[0]))?.status).toBe(404);
    expect(blockPublicCentralUserManagerRequest(request("/api/_worker/central-user-manager/"))).toBeNull();
    expect(blockPublicCentralUserManagerRequest(request("/api/internal/central-user-manager/v1/health/"))).toBeNull();
  });
});

describe("Central User Manager named RPC entrypoint", () => {
  it("is the only Worker route that dispatches an operation to OpenNext", async () => {
    const env = { binding: "runtime-only" };
    const ctx = context();
    const input = { action: "list_users" };
    workerMocks.openNextFetch.mockResolvedValueOnce(Response.json({ ok: true }));

    const entrypoint = Object.assign(
      new CentralUserManagerEntrypoint(),
      { ctx, env },
    );
    await expect(entrypoint.executeOperation(input)).resolves.toEqual({ ok: true });

    expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
    const [bridgeRequest, receivedEnv, receivedCtx] = workerMocks.openNextFetch.mock.calls[0];
    expect(bridgeRequest).toBeInstanceOf(Request);
    expect(bridgeRequest.url).toBe("https://worker.internal/api/_worker/central-user-manager");
    expect(bridgeRequest.method).toBe("POST");
    expect(bridgeRequest.headers.get("Content-Type")).toBe("application/json");
    await expect(bridgeRequest.json()).resolves.toEqual(input);
    expect(receivedEnv).toBe(env);
    expect(receivedCtx).toBe(ctx);
    expect(Object.getOwnPropertyNames(CentralUserManagerEntrypoint.prototype)).toEqual([
      "constructor",
      "executeOperation",
    ]);
  });

  it("redacts an unavailable private bridge", async () => {
    workerMocks.openNextFetch.mockRejectedValueOnce(new Error("private bridge unavailable"));

    const entrypoint = Object.assign(
      new CentralUserManagerEntrypoint(),
      { ctx: context(), env: {} },
    );

    await expect(entrypoint.executeOperation({})).resolves.toEqual({
      ok: false,
      error: {
        code: "agent_unavailable",
        message: "User management is unavailable.",
      },
    });
  });
});

describe("baan02 Central User Manager configuration", () => {
  it("pins the enabled Poolvillapattaya Tenant identity", () => {
    const source = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
    const baan02 = source.slice(source.indexOf('"baan02": {'), source.indexOf('"baan03": {'));

    expect(baan02).toMatch(/"name": "pool-villa-pattaya-co-th"/);
    expect(baan02).toMatch(/"CENTRAL_USER_MANAGER_AGENT_ENABLED": "true"/);
    expect(baan02).toMatch(/"CENTRAL_USER_MANAGER_TENANT_ID": "9fd7c645-563a-4cce-85ac-20ffb8f3bfc0"/);
    expect(baan02).toMatch(/"CENTRAL_USER_MANAGER_PROJECT_REF": "[a-z0-9]{20}"/);
  });
});
