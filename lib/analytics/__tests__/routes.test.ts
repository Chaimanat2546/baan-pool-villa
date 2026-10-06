import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const storage = vi.hoisted(() => ({
  recordAnalyticsEvent: vi.fn(),
  getAnalyticsReport: vi.fn(),
  getAnalyticsHealth: vi.fn(),
}));
vi.mock("../server", () => storage);
import { handleAnalyticsRequest } from "../routes";
import { getAnalyticsConfig } from "../config";
import { AnalyticsError } from "../types";
const event = {
  schema_version: 1,
  event_id: "11111111-1111-4111-8111-111111111111",
  event_name: "page_view",
  villa_id: null,
  channel: null,
  page_path: "/",
};
const request = (body: unknown) =>
  new Request("https://example.com/api/analytics/v1/events", {
    method: "POST",
    headers: {
      origin: "https://example.com",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv("ANALYTICS_ENABLED", "true");
  vi.stubEnv("ANALYTICS_ALLOWED_ORIGINS", "https://example.com");
  vi.resetAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
it("returns stored only after the database write resolves", async () => {
  let resolve!: (s: string) => void;
  storage.recordAnalyticsEvent.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  let finished = false;
  const pending = handleAnalyticsRequest(request(event)).then((r) => {
    finished = true;
    return r;
  });
  await vi.waitFor(() =>
    expect(storage.recordAnalyticsEvent).toHaveBeenCalled(),
  );
  expect(finished).toBe(false);
  resolve("stored");
  const result = await pending;
  expect(result.status).toBe(201);
  expect(await result.json()).toEqual({
    status: "stored",
    event_id: event.event_id,
  });
});
it("does not claim storage success on failure and preserves conflict", async () => {
  storage.recordAnalyticsEvent.mockRejectedValue(
    new AnalyticsError("EVENT_ID_CONFLICT", 409),
  );
  expect((await handleAnalyticsRequest(request(event))).status).toBe(409);
  storage.recordAnalyticsEvent.mockRejectedValue(new Error("secret SQL text"));
  const result = await handleAnalyticsRequest(request(event));
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("secret SQL text");
});
it("rejects unknown fields and actual oversized body without content-length", async () => {
  expect(
    (await handleAnalyticsRequest(request({ ...event, site_id: "forged" })))
      .status,
  ).toBe(422);
  expect(
    (
      await handleAnalyticsRequest(
        request({ ...event, extra: "x".repeat(17000) }),
      )
    ).status,
  ).toBe(413);
  expect(storage.recordAnalyticsEvent).not.toHaveBeenCalled();
});
it("never falls back to the catalog URL or a different tenant", () => {
  expect(() =>
    getAnalyticsConfig({
      NODE_ENV: "test",
      SUPABASE_URL: "https://catalog.supabase.co",
      SUPABASE_SECRET_KEY: "test",
      ANALYTICS_SITE_ID: "a",
    }),
  ).toThrow();
  expect(() =>
    getAnalyticsConfig({
      NODE_ENV: "test",
      NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL: "https://wrong.supabase.co",
      SUPABASE_SECRET_KEY: "test",
      ANALYTICS_SITE_ID: "a",
      CENTRAL_USER_MANAGER_PROJECT_REF: "correct",
    }),
  ).toThrow();
});
