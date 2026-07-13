import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminSiteSettingsSectionResponse,
  saveAdminSiteSettingsSection,
} from "@/lib/site-settings/admin-section-route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/route-helpers", () => ({ requireHomeConfigAdmin: vi.fn() }));
vi.mock("@/lib/site-settings/admin-section-route", () => ({
  buildAdminSiteSettingsSectionResponse: vi.fn(),
  saveAdminSiteSettingsSection: vi.fn(),
}));

const requireAdminMock = vi.mocked(requireHomeConfigAdmin);
const getResponseMock = vi.mocked(buildAdminSiteSettingsSectionResponse);
const patchResponseMock = vi.mocked(saveAdminSiteSettingsSection);
const request = new Request("https://example.com/api/admin/site-settings/brand");
const context = (section: string) => ({ params: Promise.resolve({ section }) });

describe("dynamic site-settings section route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for unknown sections before auth", async () => {
    const { GET } = await import("./route");
    const response = await GET(request, context("unknown"));
    expect(response.status).toBe(404);
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("authorizes and delegates GET with awaited dynamic params", async () => {
    const supabase = {} as never;
    requireAdminMock.mockResolvedValue({ ok: true, supabase });
    getResponseMock.mockResolvedValue(Response.json({ section: "brand" }));
    const { GET } = await import("./route");
    const response = await GET(request, context("brand"));
    expect(response.status).toBe(200);
    expect(getResponseMock).toHaveBeenCalledWith("brand", supabase);
  });

  it("returns auth failures without calling PATCH orchestration", async () => {
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(request, context("theme"));
    expect(response.status).toBe(401);
    expect(patchResponseMock).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown PATCH sections before auth", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(request, context("unknown"));
    expect(response.status).toBe(404);
    expect(requireAdminMock).not.toHaveBeenCalled();
    expect(patchResponseMock).not.toHaveBeenCalled();
  });

  it("authorizes and delegates PATCH with awaited dynamic params", async () => {
    const supabase = {} as never;
    requireAdminMock.mockResolvedValue({ ok: true, supabase });
    patchResponseMock.mockResolvedValue(Response.json({ section: "theme" }));
    const { PATCH } = await import("./route");
    const response = await PATCH(request, context("theme"));
    expect(response.status).toBe(200);
    expect(patchResponseMock).toHaveBeenCalledWith(request, "theme", supabase);
  });
});
