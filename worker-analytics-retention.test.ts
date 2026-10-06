import { expect, it, vi, afterEach } from "vitest";
import { pruneAnalytics } from "./worker-analytics-retention.js";
afterEach(() => vi.unstubAllGlobals());
it("does not delete if retention is disabled or tenant config is absent", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await pruneAnalytics({ ANALYTICS_RETENTION_ENABLED: "false" });
  await expect(
    pruneAnalytics({ ANALYTICS_RETENTION_ENABLED: "true" }),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("bounds cleanup work and fails visibly on storage errors", async () => {
  const env = {
    ANALYTICS_RETENTION_ENABLED: "true",
    ANALYTICS_SITE_ID: "test",
    NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: "https://example.supabase.co",
    CENTRAL_USER_MANAGER_PROJECT_REF: "example",
    SUPABASE_SECRET_KEY: "test-only",
  };
  const fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ removed: 10000 }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);
  await pruneAnalytics(env);
  expect(fetch).toHaveBeenCalledTimes(10);
  fetch.mockImplementation(async () => new Response("failed", { status: 503 }));
  await expect(pruneAnalytics(env)).rejects.toThrow(
    "Analytics retention failed",
  );
});
