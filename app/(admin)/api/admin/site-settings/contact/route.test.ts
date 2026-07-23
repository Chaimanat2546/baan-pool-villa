import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  getAdminSiteContactSettings,
  saveAdminSiteContactSettings,
} from "@/lib/site-contact-settings/admin-route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/route-helpers", () => ({ requireHomeConfigAdmin: vi.fn() }));
vi.mock("@/lib/site-contact-settings/admin-route", () => ({
  getAdminSiteContactSettings: vi.fn(),
  saveAdminSiteContactSettings: vi.fn(),
}));

const requireAdminMock = vi.mocked(requireHomeConfigAdmin);
const getMock = vi.mocked(getAdminSiteContactSettings);
const patchMock = vi.mocked(saveAdminSiteContactSettings);
const request = new Request("https://example.com/api/admin/site-settings/contact");

describe("static site contact settings route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth failures without touching persistence", async () => {
    requireAdminMock.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { GET } = await import("./route");

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("authorizes and delegates GET and PATCH", async () => {
    const supabase = {} as never;
    requireAdminMock.mockResolvedValue({ ok: true, supabase });
    getMock.mockResolvedValue(Response.json({ section: "contact" }));
    patchMock.mockResolvedValue(Response.json({ section: "contact" }));
    const { GET, PATCH } = await import("./route");

    expect((await GET(request)).status).toBe(200);
    expect((await PATCH(request)).status).toBe(200);
    expect(getMock).toHaveBeenCalledWith(supabase);
    expect(patchMock).toHaveBeenCalledWith(request, supabase);
  });
});
