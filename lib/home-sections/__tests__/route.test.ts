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

function putRequest(body: unknown) {
  return new Request("https://example.com/api/admin/home-sections", {
    body: JSON.stringify(body),
    headers: {
      authorization: "Bearer token",
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
            items: [{ houseId: "901", isActive: true }],
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
      snapshot: [
        {
          slug: "featured",
          title: "Featured villas",
          description: "Recommended villas",
          mode: "manual",
          fallback_mode: "none",
          slice_offset: 0,
          is_active: true,
          limit_count: 1,
          display_order: 0,
          cta_enabled: false,
          cta_label: null,
          cta_href: null,
          items: [
            {
              house_id: "901",
              position: 0,
              is_active: true,
            },
          ],
        },
      ],
    });
    expect(revalidateHomeSectionsCacheMock).toHaveBeenCalledTimes(1);
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
      snapshot: [
        expect.objectContaining({
          items: [
            expect.objectContaining({
              house_id: "901",
              is_active: false,
            }),
          ],
        }),
      ],
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
