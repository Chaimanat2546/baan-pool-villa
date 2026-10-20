import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/(public)/api/advertisements/route";
import { getActiveAdvertisements } from "../server";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
vi.mock("../server", () => ({ getActiveAdvertisements: vi.fn() }));
vi.mock("@/lib/api/rate-limit", () => ({ limitPublicApiRequest: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
describe("public advertisement pages", () => {
  it.each(["zone=bad", "after=bad", "after=1:invalid", "after=10000:10000000-0000-4000-8000-000000000001"])("rejects invalid input: %s", async query => {
    expect((await GET(new Request(`https://example.com/api/advertisements?${query}`))).status).toBe(400);
    expect(getActiveAdvertisements).not.toHaveBeenCalled();
  });
  it("returns the requested active zone page with shared caching", async () => {
    vi.mocked(getActiveAdvertisements).mockResolvedValue({ advertisements: [], nextCursor: null });
    const response = await GET(new Request("https://example.com/api/advertisements?zone=pattaya"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("43200");
    expect(getActiveAdvertisements).toHaveBeenCalledWith("pattaya", undefined);
  });
  it("does not cache a failed page and leaves retry available", async () => {
    vi.mocked(getActiveAdvertisements).mockRejectedValue(new Error("unavailable"));
    const response = await GET(new Request("https://example.com/api/advertisements"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("stops before the database when rate limited", async () => {
    vi.mocked(limitPublicApiRequest).mockReturnValueOnce(new Response(null, { status: 429 }));
    expect((await GET(new Request("https://example.com/api/advertisements"))).status).toBe(429);
    expect(getActiveAdvertisements).not.toHaveBeenCalled();
  });
});
