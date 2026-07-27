import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidateHomeSectionsCache } from "@/lib/cache-revalidation";
import {
  assertHomeConfigAdmin,
  getBearerToken,
} from "@/lib/admin/home-config-auth";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateHomeSectionsCache: vi.fn(),
}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn((message: string, status: number) =>
    Response.json({ error: message }, { status }),
  ),
}));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const revalidateHomeSectionsCacheMock = vi.mocked(revalidateHomeSectionsCache);

const layout = [
  { kind: "rail", key: "featured", enabled: true },
  { kind: "fixed", key: "why_choose", enabled: true },
  { kind: "fixed", key: "tiktok", enabled: true },
  { kind: "fixed", key: "customer_reviews", enabled: true },
  { kind: "fixed", key: "articles", enabled: true },
  { kind: "fixed", key: "faq", enabled: true },
  { kind: "fixed", key: "contact", enabled: true },
] as const;

const featuredSection = {
  slug: "featured",
  title: "Featured villas",
  description: "Recommended villas",
  mode: "manual",
  limitCount: 1,
  fallbackMode: "none",
  sliceOffset: 0,
  isActive: true,
  ctaEnabled: false,
  ctaLabel: "",
  ctaHref: "",
  items: [{ houseId: "901", isActive: true }],
};

function putRequest(body: unknown) {
  return new Request("https://example.com/api/admin/home-sections", {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer token",
      origin: "https://example.com",
      "content-type": "application/json",
    },
    method: "PUT",
  });
}

function invalidJsonPutRequest() {
  return new Request("https://example.com/api/admin/home-sections", {
    body: "{",
    headers: {
      authorization: "Bearer token",
      origin: "https://example.com",
      "content-type": "application/json",
    },
    method: "PUT",
  });
}

describe("admin home sections route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
  });

  it("loads the saved layout with the editable rails", async () => {
    const sectionOrder = vi
      .fn()
      .mockReturnValueOnce({ order: vi.fn().mockResolvedValue({
        data: [{
          slug: "featured",
          title: "Featured villas",
          description: "Recommended villas",
          display_order: 0,
          is_active: true,
          mode: "manual",
          limit_count: 1,
          cta_enabled: false,
          cta_label: null,
          cta_href: null,
          fallback_mode: "none",
          slice_offset: 0,
          home_section_items: [],
        }],
        error: null,
      }) });
    const from = vi.fn((table: string) => table === "home_sections"
      ? { select: vi.fn(() => ({ order: sectionOrder })) }
      : {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { layout },
                error: null,
              }),
            })),
          })),
        });
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { from },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { GET } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await GET(new Request(
      "https://example.com/api/admin/home-sections",
      {
        headers: {
          authorization: "Bearer token",
          origin: "https://example.com",
        },
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      layout,
      sections: [{ slug: "featured" }],
    });
    expect(from).toHaveBeenCalledWith("home_page_layout");
  });

  it("revalidates public home section cache after a successful save", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { rpc },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await PUT(
      putRequest({
        layout,
        sections: [featuredSection],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      layout,
      sections: [
        {
          slug: "featured",
          title: "Featured villas",
          description: "Recommended villas",
          mode: "manual",
          fallbackMode: "none",
          sliceOffset: 0,
          isActive: true,
          limitCount: 1,
          displayOrder: 0,
          ctaEnabled: false,
          ctaLabel: "",
          ctaHref: "",
          items: [
            {
              houseId: "901",
              position: 0,
              isActive: true,
            },
          ],
        },
      ],
    });
    expect(rpc).toHaveBeenCalledWith("save_home_section_snapshot", {
      snapshot: {
        layout,
        sections: [
          expect.objectContaining({
            slug: "featured",
            display_order: 0,
            is_active: true,
          }),
        ],
      },
    });
    expect(revalidateHomeSectionsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("saves a fixed-only layout after deleting the final rail", async () => {
    const fixedOnlyLayout = layout.filter((item) => item.kind === "fixed");
    const rpc = vi.fn().mockResolvedValue({ error: null });
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { rpc },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await PUT(
      putRequest({
        layout: fixedOnlyLayout,
        sections: [],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      layout: fixedOnlyLayout,
      sections: [],
    });
    expect(rpc).toHaveBeenCalledWith("save_home_section_snapshot", {
      snapshot: {
        layout: fixedOnlyLayout,
        sections: [],
      },
    });
    expect(revalidateHomeSectionsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a layout that omits a fixed section", async () => {
    const rpc = vi.fn();
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { rpc },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await PUT(
      putRequest({
        layout: layout.filter((item) => item.key !== "contact"),
        sections: [featuredSection],
      }),
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidateHomeSectionsCacheMock).not.toHaveBeenCalled();
  });

  it("returns a warning when cache revalidation fails after the save", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    revalidateHomeSectionsCacheMock.mockRejectedValueOnce(
      new Error("cache unavailable"),
    );
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { rpc },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await PUT(
      putRequest({
        layout,
        sections: [featuredSection],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      layout,
      sections: [
        {
          slug: "featured",
          title: "Featured villas",
          description: "Recommended villas",
          mode: "manual",
          fallbackMode: "none",
          sliceOffset: 0,
          isActive: true,
          limitCount: 1,
          displayOrder: 0,
          ctaEnabled: false,
          ctaLabel: "",
          ctaHref: "",
          items: [
            {
              houseId: "901",
              position: 0,
              isActive: true,
            },
          ],
        },
      ],
      warnings: ["บันทึกหน้าแรกแล้ว แต่การรีเฟรชแคชไม่สำเร็จ"],
    });
  });

  it("passes disabled item state to the home section RPC payload", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { rpc },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await PUT(
      putRequest({
        layout,
        sections: [
          {
            slug: "featured",
            title: "Featured villas",
            description: "Recommended villas",
            mode: "manual",
            limitCount: 1,
            fallbackMode: "none",
            sliceOffset: 0,
            isActive: true,
            ctaEnabled: false,
            ctaLabel: "",
            ctaHref: "",
            items: [{ houseId: "901", isActive: false }],
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("save_home_section_snapshot", {
      snapshot: {
        layout,
        sections: [
          expect.objectContaining({
            items: [
              expect.objectContaining({
                house_id: "901",
                is_active: false,
              }),
            ],
          }),
        ],
      },
    });
  });

  it("rejects invalid JSON before saving or revalidating", async () => {
    const rpc = vi.fn();
    assertHomeConfigAdminMock.mockResolvedValue({
      ok: true,
      supabase: { rpc },
    } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/home-sections/route"
    );
    const response = await PUT(invalidJsonPutRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: ["Request body must be JSON."],
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidateHomeSectionsCacheMock).not.toHaveBeenCalled();
  });
});
