import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { AdminVillaReviewError, listAdminVillaReviews } from "@/lib/villa-reviews/admin";
import { GET } from "../route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/route-helpers", () => ({ requireHomeConfigAdmin: vi.fn() }));
vi.mock("@/lib/cache-revalidation", () => ({ revalidateVillaReviewsCache: vi.fn() }));
vi.mock("@/lib/villas/server", () => ({ fetchVillaTitlesByIds: vi.fn() }));
vi.mock("@/lib/villa-reviews/admin", async (original) => ({
  ...await original<typeof import("@/lib/villa-reviews/admin")>(), listAdminVillaReviews: vi.fn(),
}));

describe("admin review list route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireHomeConfigAdmin).mockResolvedValue({ ok: true, userId: "11111111-1111-4111-8111-111111111111", supabase: {} } as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
    vi.mocked(listAdminVillaReviews).mockResolvedValue({ items: [], total: 0, page: 8, pageSize: 6 });
  });

  it("returns auth failure before queries", async () => {
    const denied = Response.json({ code: "session_invalid" }, { status: 401 });
    vi.mocked(requireHomeConfigAdmin).mockResolvedValue({ ok: false, response: denied });
    expect(await GET(new Request("https://test.local/api/admin/villa-reviews"))).toBe(denied);
    expect(listAdminVillaReviews).not.toHaveBeenCalled();
  });

  it.each(["q=" + "a".repeat(101), "cursor=abc", "page=0", "page=1.5", "page=01", "page=", "pageSize=7", "sort=bad", "hasImages=yes", "dateFrom=2026-02-30", "dateFrom=2026-09-08&dateTo=2026-09-07", "villaId=bad", "rating=0", "rating=6", "rating=5.0", "rating=05", "rating=", "q=a&q=b", "rating=1&rating=2", "page=1&page=2", "limit=100", "q=%00"])("rejects invalid bounded query %s", async (query) => {
    const response = await GET(new Request(`https://test.local/api/admin/villa-reviews?${query}`));
    expect(response.status).toBe(400);
    expect(listAdminVillaReviews).not.toHaveBeenCalled();
  });

  it("parses filters and returns the page DTO without wrapping it", async () => {
    const response = await GET(new Request("https://test.local/api/admin/villa-reviews?q=%20DV01%20&rating=4&page=8&pageSize=6&sort=lowest&villaId=9&dateFrom=2026-09-01&dateTo=2026-09-07&hasImages=false"));
    expect(listAdminVillaReviews).toHaveBeenCalledWith({ search: "DV01", rating: 4, page: 8, pageSize: 6, sort: "lowest", villaId: "9", dateFrom: "2026-09-01", dateTo: "2026-09-07", hasImages: false });
    expect(await response.json()).toEqual({ items: [], total: 0, page: 8, pageSize: 6 });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("preserves service validation errors", async () => {
    vi.mocked(listAdminVillaReviews).mockRejectedValue(new AdminVillaReviewError("validation_error", "ตัวระบุหน้าไม่ถูกต้อง", 400));
    const response = await GET(new Request("https://test.local/api/admin/villa-reviews?page=8"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "ตัวระบุหน้าไม่ถูกต้อง", code: "validation_error" });
  });

  it("does not expose unexpected service exception details", async () => {
    vi.mocked(listAdminVillaReviews).mockRejectedValue(new Error("secret phone +66812345678"));
    const response = await GET(new Request("https://test.local/api/admin/villa-reviews"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("+66812345678");
  });
});
