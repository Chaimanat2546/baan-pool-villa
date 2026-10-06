// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { track } from "../client";
const contact = {
  event_name: "contact_click",
  channel: "line",
  villa_id: null,
  page_path: "/",
} as const;
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("sends without storage, cookies or referrer and never uses beacon", () => {
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const beacon = vi.fn();
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: beacon,
  });
  const fetch = vi.fn(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetch);
  track({
    ...contact,
    page_path: "/?email=secret#private",
    email: "secret",
  } as unknown as typeof contact);
  track(contact);
  expect(fetch).toHaveBeenCalledTimes(2);
  const init = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(init[1]).toMatchObject({
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    keepalive: true,
  });
  const first = JSON.parse(String(init[1].body));
  const second = JSON.parse(
    String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body),
  );
  expect(Object.keys(first).sort()).toEqual([
    "channel",
    "event_id",
    "event_name",
    "page_path",
    "schema_version",
    "villa_id",
  ]);
  expect(first.page_path).toBe("/");
  expect(first.event_id).not.toBe(second.event_id);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(beacon).not.toHaveBeenCalled();
});
it("reuses the same event ID on bounded fetch retries and strips query", async () => {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: () => false,
  });
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      bodies.push(init.body);
      return new Response("{}", { status: 503 });
    }),
  );
  track({ ...contact, page_path: "/?secret=hidden" });
  await vi.advanceTimersByTimeAsync(30000);
  expect(bodies).toHaveLength(3);
  expect(new Set(bodies).size).toBe(1);
  expect(JSON.parse(bodies[0]).page_path).toBe("/");
});
it("does not retry when collection is disabled", async () => {
  const fetch = vi.fn(
    async () =>
      new Response('{"error":{"code":"TRACKING_DISABLED"}}', { status: 503 }),
  );
  vi.stubGlobal("fetch", fetch);
  track(contact);
  await vi.advanceTimersByTimeAsync(30000);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("reduces guide slugs to a content category", async () => {
  const bodies: string[] = [];
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return new Response("{}", { status: 201 });
  });
  vi.stubGlobal("fetch", fetch);
  track({
    event_name: "page_view",
    channel: null,
    villa_id: null,
    page_path: "/guides/บ้านพัก",
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(bodies[0]).page_path).toBe("/guides");
});
