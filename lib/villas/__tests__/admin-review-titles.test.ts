import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
import { fetchVillaTitlesByIds } from "../server";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-only-key"); });
afterEach(() => { vi.unstubAllEnvs(); });

it("resolves review titles with one bounded projection and filters unusable IDs and titles", async () => {
  const query = { select: vi.fn(() => query), in: vi.fn(() => query), eq: vi.fn(() => query), limit: vi.fn(async () => ({ data: [{ property_id: 9, title: "  บ้านสายลม  " }, { property_id: 10, title: null }], error: null })) };
  const from = vi.fn(() => query);
  createClient.mockReturnValue({ from });
  expect(await fetchVillaTitlesByIds(["9", "9", "10", "bogus", "-1"])).toEqual(new Map([["9", "บ้านสายลม"]]));
  expect(from).toHaveBeenCalledExactlyOnceWith("listings");
  expect(query.select).toHaveBeenCalledExactlyOnceWith("property_id,title");
  expect(query.in).toHaveBeenCalledExactlyOnceWith("property_id", [9, 10]);
  expect(query.limit).toHaveBeenCalledWith(25);
});

it("caps title IDs at 25 and skips an empty catalog query", async () => {
  const query = { select: vi.fn(() => query), in: vi.fn((_column: string, ids: number[]) => { expect(ids.every(Number.isSafeInteger)).toBe(true); return query; }), eq: vi.fn(() => query), limit: vi.fn(async () => ({ data: [], error: null })) };
  createClient.mockReturnValue({ from: vi.fn(() => query) });
  expect(await fetchVillaTitlesByIds([])).toEqual(new Map());
  expect(createClient).not.toHaveBeenCalled();
  await fetchVillaTitlesByIds(Array.from({ length: 30 }, (_, index) => String(index + 1)));
  expect(query.in.mock.calls[0][1]).toHaveLength(25);
});
