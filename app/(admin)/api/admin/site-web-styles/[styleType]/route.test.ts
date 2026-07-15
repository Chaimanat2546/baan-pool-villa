import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  getAdminWebStyle,
  saveAdminWebStyle,
} from "@/lib/site-web-styles/admin-route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/route-helpers", () => ({ requireHomeConfigAdmin: vi.fn() }));
vi.mock("@/lib/site-web-styles/admin-route", () => ({
  getAdminWebStyle: vi.fn(),
  saveAdminWebStyle: vi.fn(),
}));

const requireAdminMock = vi.mocked(requireHomeConfigAdmin);
const getStyleMock = vi.mocked(getAdminWebStyle);
const saveStyleMock = vi.mocked(saveAdminWebStyle);
const request = new Request("https://example.com/api/admin/site-web-styles/gallery");
const context = (styleType: string) => ({ params: Promise.resolve({ styleType }) });

describe("dynamic site web styles route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unknown style types before auth", async () => {
    const { GET } = await import("./route");
    const response = await GET(request, context("footer"));

    expect(response.status).toBe(404);
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("authorizes and delegates Gallery GET", async () => {
    const supabase = {} as never;
    requireAdminMock.mockResolvedValue({ ok: true, supabase });
    getStyleMock.mockResolvedValue(Response.json({ settings: { variant: "lightbox" } }));
    const { GET } = await import("./route");

    const response = await GET(request, context("gallery"));

    expect(response.status).toBe(200);
    expect(getStyleMock).toHaveBeenCalledWith("gallery", supabase);
  });

  it("returns auth failures before PATCH persistence", async () => {
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(request, context("gallery"));

    expect(response.status).toBe(401);
    expect(saveStyleMock).not.toHaveBeenCalled();
  });

  it("authorizes and delegates Gallery PATCH", async () => {
    const supabase = {} as never;
    requireAdminMock.mockResolvedValue({ ok: true, supabase });
    saveStyleMock.mockResolvedValue(Response.json({ settings: { variant: "lightbox" } }));
    const { PATCH } = await import("./route");

    const response = await PATCH(request, context("gallery"));

    expect(response.status).toBe(200);
    expect(saveStyleMock).toHaveBeenCalledWith("gallery", request, supabase);
  });
});
