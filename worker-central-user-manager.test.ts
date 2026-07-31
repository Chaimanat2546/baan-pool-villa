import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { parseWranglerConfig } from "./scripts/production-deploy-config.mjs";
import {
  handleCentralUserManagerRequest,
  isCentralUserManagerPath,
} from "./worker-central-user-manager.js";

const HEALTH_PATH =
  "/api/internal/central-user-manager/v1/health";
const OPERATIONS_PATH =
  "/api/internal/central-user-manager/v1/operations";
const CLIENT_IP = "203.0.113.80";
const EXPECTED_HARDENING_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
} as const;
const WRANGLER_CONFIG_PATH = fileURLToPath(
  new URL("./wrangler.jsonc", import.meta.url),
);

const workerMocks = vi.hoisted(() => {
  const cacheFunctions = {
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
  };

  return {
    cacheFunctions,
    calendarAccess: vi.fn(),
    htmlVersionToken: vi.fn(),
    openNextFetch: vi.fn(),
  };
});

vi.mock("./.open-next/worker.js", () => ({
  BucketCachePurge: class BucketCachePurge {},
  DOQueueHandler: class DOQueueHandler {},
  DOShardedTagCache: class DOShardedTagCache {},
  default: {
    fetch: workerMocks.openNextFetch,
  },
}));

vi.mock("./worker-cache-policy.js", () => workerMocks.cacheFunctions);

vi.mock("./worker-calendar-access.js", () => ({
  handleBookingCalendarAccess: workerMocks.calendarAccess,
}));

vi.mock("./worker-html-cache-version.js", () => ({
  getHtmlEdgeCacheVersionToken: workerMocks.htmlVersionToken,
}));

import worker from "./worker.js";

interface RateLimiterResult {
  success: boolean;
}

function createRateLimiter(
  resolveResult: (
    requestNumber: number,
  ) => unknown | Promise<unknown> = () => ({ success: true }),
) {
  let requestNumber = 0;

  return {
    limit: vi.fn(async () => {
      requestNumber += 1;

      return resolveResult(requestNumber);
    }),
  };
}

function createEnvironment(
  limiter = createRateLimiter(),
): {
  CENTRAL_USER_MANAGER_RATE_LIMITER: typeof limiter;
} {
  return {
    CENTRAL_USER_MANAGER_RATE_LIMITER: limiter,
  };
}

function centralRequest(
  path = HEALTH_PATH,
  {
    authorization = "Bearer request-credential-must-stay-opaque",
    clientIp = CLIENT_IP,
    method = "GET",
  }: {
    authorization?: string | null;
    clientIp?: string | null;
    method?: string;
  } = {},
) {
  const headers = new Headers();

  if (authorization !== null) {
    headers.set("Authorization", authorization);
  }
  if (clientIp !== null) {
    headers.set("CF-Connecting-IP", clientIp);
  }

  return new Request(`https://tenant.example${path}`, {
    headers,
    method,
  });
}

function expectExactHardeningHeaders(response: Response) {
  for (const [name, value] of Object.entries(
    EXPECTED_HARDENING_HEADERS,
  )) {
    expect(response.headers.get(name), name).toBe(value);
  }
}

async function expectStaticUnavailableResponse(response: Response) {
  expect(response.status).toBe(503);
  expectExactHardeningHeaders(response);
  expect(response.headers.get("Content-Type")).toBe(
    "application/json",
  );
  expect(await response.text()).toBe(
    JSON.stringify({
      error: {
        code: "agent_unavailable",
        message: "Central User Manager Agent is unavailable.",
      },
    }),
  );
}

function createExecutionContext() {
  return {
    waitUntil: vi.fn(),
  };
}

beforeEach(() => {
  workerMocks.openNextFetch.mockReset();
  workerMocks.openNextFetch.mockResolvedValue(
    Response.json({ ok: true }, { status: 200 }),
  );
  workerMocks.calendarAccess.mockReset();
  workerMocks.htmlVersionToken.mockReset();
  for (const cacheFunction of Object.values(
    workerMocks.cacheFunctions,
  )) {
    cacheFunction.mockReset();
  }
});

describe("Central User Manager Worker path boundary", () => {
  it.each([HEALTH_PATH, OPERATIONS_PATH])(
    "classifies the exact Agent pathname %s",
    (pathname) => {
      expect(isCentralUserManagerPath(pathname)).toBe(true);
    },
  );

  it.each([
    "",
    "/api/internal/central-user-manager/v1",
    `${HEALTH_PATH}/`,
    `${OPERATIONS_PATH}/`,
    `${HEALTH_PATH}/ready`,
    `${OPERATIONS_PATH}/operation-id`,
    `${HEALTH_PATH}-check`,
    `${OPERATIONS_PATH}-batch`,
    `/prefix${HEALTH_PATH}`,
    `/prefix${OPERATIONS_PATH}`,
    "/api/internal/central-user-manager/v1/Health",
    "/api/internal/central-user-manager/v1/OPERATIONS",
    "/api/internal/central-user-manager/v01/health",
    "/api/internal/central-user-manager/v1/%68ealth",
    "/api/internal/central-user-manager/v1/%6fperations",
    "/api/internal/central-user-manager/v1%2Fhealth",
    "/api/internal/central-user-manager/v1//health",
    "/api/internal/central-user-manager/v1/health%2Fready",
    "/api/internal/central-user-manager/v1/health.",
    "/api/internal/central-user-manager/v1/health;",
    "/api/internal/central-user-manager/v1/users",
    "/api/internal/central-user-manager/health",
    "/api/internal/other/v1/health",
    "/api/admin/central-user-manager/v1/health",
  ])("does not classify lookalike pathname %s", (pathname) => {
    expect(isCentralUserManagerPath(pathname)).toBe(false);
  });

  it.each([HEALTH_PATH, OPERATIONS_PATH])(
    "classifies %s independently of query text",
    async (pathname) => {
      const limiter = createRateLimiter();
      const dispatch = vi.fn(async () => new Response("route response"));
      const response = await handleCentralUserManagerRequest(
        centralRequest(
          `${pathname}?credential=must-not-affect-path-classification`,
        ),
        createEnvironment(limiter),
        createExecutionContext(),
        dispatch,
      );

      expect(response?.status).toBe(200);
      expect(limiter.limit).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledTimes(1);
    },
  );

  it("falls through unrelated requests without limiting or direct dispatch", async () => {
    const limiter = createRateLimiter();
    const dispatch = vi.fn();

    await expect(
      handleCentralUserManagerRequest(
        centralRequest("/api/internal/central-user-manager/v1/health/"),
        createEnvironment(limiter),
        createExecutionContext(),
        dispatch,
      ),
    ).resolves.toBeNull();
    expect(limiter.limit).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("Central User Manager Worker rate-limit gate", () => {
  it("passes the trimmed client IP to the limiter exactly once", async () => {
    const limiter = createRateLimiter();
    const dispatch = vi.fn(async () => new Response("ok"));

    const response = await handleCentralUserManagerRequest(
      centralRequest(HEALTH_PATH, {
        clientIp: `  ${CLIENT_IP}  `,
      }),
      createEnvironment(limiter),
      createExecutionContext(),
      dispatch,
    );

    expect(response?.status).toBe(200);
    expect(limiter.limit).toHaveBeenCalledTimes(1);
    expect(limiter.limit).toHaveBeenCalledWith({ key: CLIENT_IP });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("accepts the Cloudflare host-object success accessor", async () => {
    const rateLimitResult = Object.defineProperty({}, "success", {
      configurable: true,
      enumerable: true,
      get: () => true,
    });
    const limiter = createRateLimiter(() => rateLimitResult);
    const dispatch = vi.fn(async () => new Response("ok"));

    const response = await handleCentralUserManagerRequest(
      centralRequest(),
      createEnvironment(limiter),
      createExecutionContext(),
      dispatch,
    );

    expect(response?.status).toBe(200);
    expect(limiter.limit).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("rejects request 61 for one IP without dispatching it", async () => {
    const limiter = createRateLimiter(
      (requestNumber): RateLimiterResult => ({
        success: requestNumber <= 60,
      }),
    );
    const dispatch = vi.fn(async () => new Response("ok"));
    const env = createEnvironment(limiter);
    const ctx = createExecutionContext();

    for (let requestNumber = 1; requestNumber <= 60; requestNumber += 1) {
      const response = await handleCentralUserManagerRequest(
        centralRequest(OPERATIONS_PATH, { method: "POST" }),
        env,
        ctx,
        dispatch,
      );

      expect(response?.status).toBe(200);
    }

    const blocked = await handleCentralUserManagerRequest(
      centralRequest(OPERATIONS_PATH, { method: "POST" }),
      env,
      ctx,
      dispatch,
    );

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("60");
    expectExactHardeningHeaders(blocked as Response);
    expect(limiter.limit).toHaveBeenCalledTimes(61);
    expect(dispatch).toHaveBeenCalledTimes(60);
  });

  it.each([
    ["missing", null],
    ["blank", "   "],
  ])(
    "fails closed before the limiter when CF-Connecting-IP is %s",
    async (_label, clientIp) => {
      const limiter = createRateLimiter();
      const dispatch = vi.fn();
      const response = await handleCentralUserManagerRequest(
        centralRequest(HEALTH_PATH, { clientIp }),
        createEnvironment(limiter),
        createExecutionContext(),
        dispatch,
      );

      expect(response?.status).toBe(503);
      expectExactHardeningHeaders(response as Response);
      expect(limiter.limit).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing environment", undefined],
    ["missing binding", {}],
    [
      "non-callable binding",
      { CENTRAL_USER_MANAGER_RATE_LIMITER: { limit: true } },
    ],
  ])("fails closed for a %s", async (_label, env) => {
    const dispatch = vi.fn();
    const response = await handleCentralUserManagerRequest(
      centralRequest(),
      env,
      createExecutionContext(),
      dispatch,
    );

    expect(response?.status).toBe(503);
    expectExactHardeningHeaders(response as Response);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fails closed when the limiter rejects", async () => {
    const limiter = {
      limit: vi.fn(async () => {
        throw new Error("binding failure details must stay private");
      }),
    };
    const dispatch = vi.fn();
    const response = await handleCentralUserManagerRequest(
      centralRequest(),
      createEnvironment(limiter),
      createExecutionContext(),
      dispatch,
    );

    expect(response?.status).toBe(503);
    expectExactHardeningHeaders(response as Response);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    null,
    undefined,
    {},
    { success: "true" },
    { success: 1 },
    Object.create({ success: true }),
    Object.assign([], { success: true }),
    Object.defineProperty({}, "success", {
      get() {
        throw new Error("malformed limiter getter");
      },
    }),
  ])("fails closed for malformed limiter result %#", async (result) => {
    const limiter = createRateLimiter(() => result);
    const dispatch = vi.fn();
    const response = await handleCentralUserManagerRequest(
      centralRequest(),
      createEnvironment(limiter),
      createExecutionContext(),
      dispatch,
    );

    expect(response?.status).toBe(503);
    expectExactHardeningHeaders(response as Response);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("Central User Manager direct OpenNext dispatch", () => {
  it("fails closed when dispatch returns Response.error()", async () => {
    const dispatch = vi.fn(async () => Response.error());

    const response = await handleCentralUserManagerRequest(
      centralRequest(
        `${HEALTH_PATH}?private=reconstruction-url-value`,
        {
          authorization:
            "Bearer reconstruction-authorization-value",
          clientIp: "198.51.100.211",
        },
      ),
      createEnvironment(),
      createExecutionContext(),
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    await expectStaticUnavailableResponse(response as Response);
  });

  it("fails closed when dispatch returns a consumed response body", async () => {
    const upstreamResponse = new Response(
      "consumed-upstream-body-must-stay-private",
    );
    await upstreamResponse.text();
    const dispatch = vi.fn(async () => upstreamResponse);

    const response = await handleCentralUserManagerRequest(
      centralRequest(HEALTH_PATH),
      createEnvironment(),
      createExecutionContext(),
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    await expectStaticUnavailableResponse(response as Response);
  });

  it("fails closed when dispatch returns a locked response body", async () => {
    const upstreamResponse = new Response(
      "locked-upstream-body-must-stay-private",
    );
    const reader = upstreamResponse.body?.getReader();
    const dispatch = vi.fn(async () => upstreamResponse);

    try {
      const response = await handleCentralUserManagerRequest(
        centralRequest(OPERATIONS_PATH, { method: "POST" }),
        createEnvironment(),
        createExecutionContext(),
        dispatch,
      );

      expect(dispatch).toHaveBeenCalledTimes(1);
      await expectStaticUnavailableResponse(response as Response);
    } finally {
      await reader?.cancel();
      reader?.releaseLock();
    }
  });

  it("fails closed when response header reconstruction throws", async () => {
    const upstreamResponse = new Response(
      "throwing-header-body-must-stay-private",
    );
    Object.defineProperty(upstreamResponse, "headers", {
      configurable: true,
      get() {
        throw new Error(
          "throwing-header-details-must-stay-private",
        );
      },
    });
    const dispatch = vi.fn(async () => upstreamResponse);

    const response = await handleCentralUserManagerRequest(
      centralRequest(HEALTH_PATH),
      createEnvironment(),
      createExecutionContext(),
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    await expectStaticUnavailableResponse(response as Response);
  });

  it("fails closed when dispatch returns a non-Response value", async () => {
    const dispatch = vi.fn(async () => ({
      error: "non-response-dispatch-value-must-stay-private",
    }));

    const response = await handleCentralUserManagerRequest(
      centralRequest(HEALTH_PATH),
      createEnvironment(),
      createExecutionContext(),
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    await expectStaticUnavailableResponse(response as Response);
  });

  it("fails closed when response type validation throws", async () => {
    const malformedResponse = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error(
            "response-validation-details-must-stay-private",
          );
        },
      },
    );
    const dispatch = vi.fn(async () => malformedResponse);

    const response = await handleCentralUserManagerRequest(
      centralRequest(HEALTH_PATH),
      createEnvironment(),
      createExecutionContext(),
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledTimes(1);
    await expectStaticUnavailableResponse(response as Response);
  });

  it.each([
    {
      path: HEALTH_PATH,
      status: 401,
      protocolHeader: "WWW-Authenticate",
      protocolValue: "Bearer",
    },
    {
      path: OPERATIONS_PATH,
      status: 405,
      protocolHeader: "Allow",
      protocolValue: "POST",
    },
  ])(
    "preserves a $status response for $path while hardening it",
    async ({ path, status, protocolHeader, protocolValue }) => {
      const ctx = createExecutionContext();
      const request = centralRequest(path);
      const env = createEnvironment();
      const dispatch = vi.fn(
        async (
          dispatchedRequest,
          dispatchedEnv,
          dispatchedContext,
        ) => {
          expect(dispatchedRequest).toBe(request);
          expect(dispatchedEnv).toBe(env);
          expect(dispatchedContext).toBe(ctx);

          return new Response("original route body", {
            headers: {
              Allow: "POST",
              "Cache-Control": "public, max-age=86400",
              Expires: "tomorrow",
              Pragma: "cache",
              "Referrer-Policy": "unsafe-url",
              "WWW-Authenticate": "Bearer",
              "X-Content-Type-Options": "off",
              "X-Upstream-Header": "retained",
            },
            status,
            statusText: "Original Status",
          });
        },
      );

      const response = await handleCentralUserManagerRequest(
        request,
        env,
        ctx,
        dispatch,
      );

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(response?.status).toBe(status);
      expect(response?.statusText).toBe("Original Status");
      expect(await response?.text()).toBe("original route body");
      expect(response?.headers.get(protocolHeader)).toBe(protocolValue);
      expect(response?.headers.get("X-Upstream-Header")).toBe("retained");
      expectExactHardeningHeaders(response as Response);
    },
  );

  it("runs ahead of every existing Worker cache and calendar dependency", async () => {
    const cacheStorageAccess = vi.fn(() => {
      throw new Error("caches.default must not be read");
    });
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      get: cacheStorageAccess,
    });

    try {
      const response = await worker.fetch(
        centralRequest(`${HEALTH_PATH}?probe=1`),
        createEnvironment(),
        createExecutionContext(),
      );

      expect(response.status).toBe(200);
      expect(workerMocks.openNextFetch).toHaveBeenCalledTimes(1);
      expect(workerMocks.openNextFetch).toHaveBeenCalledWith(
        expect.any(Request),
        expect.any(Object),
        expect.any(Object),
      );
      expect(workerMocks.calendarAccess).not.toHaveBeenCalled();
      expect(workerMocks.htmlVersionToken).not.toHaveBeenCalled();
      for (const cacheFunction of Object.values(
        workerMocks.cacheFunctions,
      )) {
        expect(cacheFunction).not.toHaveBeenCalled();
      }
      expect(cacheStorageAccess).not.toHaveBeenCalled();
      expectExactHardeningHeaders(response);
    } finally {
      Reflect.deleteProperty(globalThis, "caches");
    }
  });

  it("does not inspect or log the Bearer credential or client IP", async () => {
    const authorization =
      "Bearer opaque-value-that-the-worker-must-never-inspect";
    const privateClientIp = "198.51.100.246";
    const privateQuery = "private-query-value";
    const request = centralRequest(`${HEALTH_PATH}?probe=${privateQuery}`, {
      authorization,
      clientIp: privateClientIp,
    });
    const headerGet = vi.spyOn(request.headers, "get");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    const limiter = {
      limit: vi.fn(async () => {
        throw new Error(
          `${authorization} ${privateClientIp} ${privateQuery} binding-internal-stack`,
        );
      }),
    };

    try {
      const response = await handleCentralUserManagerRequest(
        request,
        createEnvironment(limiter),
        createExecutionContext(),
        vi.fn(),
      );
      const responseText = await response?.text();
      const serializedLogs = JSON.stringify([
        ...consoleError.mock.calls,
        ...consoleLog.mock.calls,
        ...consoleWarn.mock.calls,
      ]);

      expect(response?.status).toBe(503);
      expect(
        headerGet.mock.calls.some(
          ([name]) => name.toLowerCase() === "authorization",
        ),
      ).toBe(false);
      expect(serializedLogs).not.toContain(authorization);
      expect(serializedLogs).not.toContain(privateClientIp);
      expect(responseText).not.toContain(authorization);
      expect(responseText).not.toContain(privateClientIp);
      expect(responseText).not.toContain(privateQuery);
      expect(responseText).not.toContain("binding-internal-stack");
    } finally {
      headerGet.mockRestore();
      consoleError.mockRestore();
      consoleLog.mockRestore();
      consoleWarn.mockRestore();
    }
  });
});

describe("Central User Manager Wrangler rate-limit bindings", () => {
  it("declares one distinct dedicated 60-per-minute namespace in every environment", async () => {
    const config = parseWranglerConfig(
      await readFile(WRANGLER_CONFIG_PATH, "utf8"),
      WRANGLER_CONFIG_PATH,
    ) as {
      env: Record<
        string,
        {
          ratelimits?: Array<{
            name?: string;
            namespace_id?: string;
            simple?: { limit?: number; period?: number };
          }>;
        }
      >;
    };
    const expectedNamespaces = {
      baanparty: "91014",
      baan02: "92014",
      baanPMhee: "93014",
    } as const;
    const actualNamespaces: string[] = [];

    for (const [environmentName, namespaceId] of Object.entries(
      expectedNamespaces,
    )) {
      const bindings = config.env[environmentName]?.ratelimits ?? [];
      const centralBindings = bindings.filter(
        ({ name }) => name === "CENTRAL_USER_MANAGER_RATE_LIMITER",
      );
      const calendarBinding = bindings.find(
        ({ name }) => name === "CALENDAR_API_RATE_LIMITER",
      );

      expect(centralBindings).toEqual([
        {
          name: "CENTRAL_USER_MANAGER_RATE_LIMITER",
          namespace_id: namespaceId,
          simple: {
            limit: 60,
            period: 60,
          },
        },
      ]);
      expect(namespaceId).toMatch(/^[1-9]\d*$/);
      expect(namespaceId).not.toBe(calendarBinding?.namespace_id);
      actualNamespaces.push(namespaceId);
    }

    expect(new Set(actualNamespaces).size).toBe(actualNamespaces.length);
  });
});
