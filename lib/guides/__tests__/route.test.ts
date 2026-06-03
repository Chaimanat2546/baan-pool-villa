import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import { revalidateGuideCache } from "@/lib/cache-revalidation";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/home-config-auth", () => ({
  assertHomeConfigAdmin: vi.fn(),
  getBearerToken: vi.fn(),
  jsonError: vi.fn(
    (
      message: string,
      status: number,
      extra?: Record<string, string | null | undefined>,
    ) => Response.json({ error: message, ...extra }, { status }),
  ),
}));

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateGuideCache: vi.fn(),
}));

const assertHomeConfigAdminMock = vi.mocked(assertHomeConfigAdmin);
const getBearerTokenMock = vi.mocked(getBearerToken);
const jsonErrorMock = vi.mocked(jsonError);
const revalidateGuideCacheMock = vi.mocked(revalidateGuideCache);

const dbRow = {
  id: "guide-1",
  slug: "pool-villa-pattaya-2",
  title: "Pool Villa Pattaya",
  excerpt: "Guide excerpt",
  cover_image_path: "guides/2026/06/cover.webp",
  cover_image_url: "https://cdn.example.com/cover.webp",
  cover_image_alt: "Pool villa cover",
  content_blocks: [
    {
      id: "intro",
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: "Intro", styles: {} }],
      children: [],
    },
  ],
  tags: ["pattaya"],
  recommended_house_ids: ["66"],
  status: "published",
  is_pinned: true,
  published_at: "2026-06-03T03:00:00.000Z",
  created_at: "2026-06-01T03:00:00.000Z",
  updated_at: "2026-06-03T03:00:00.000Z",
};

const validGuide = {
  title: " Pool Villa Pattaya ",
  slug: "",
  excerpt: " Guide excerpt ",
  coverImage: {
    alt: " Pool villa cover ",
    path: " guides/2026/06/cover.webp ",
    url: " https://cdn.example.com/cover.webp ",
  },
  contentBlocks: dbRow.content_blocks,
  tags: [" pattaya ", "pattaya"],
  recommendedHouseIds: ["DV-66"],
  status: "published",
  isPinned: true,
  publishedAt: null,
};

function jsonRequest(method: string, body?: unknown) {
  return new Request("https://example.com/api/admin/guides", {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    method,
  });
}

function guideListQuery(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);

  return { select };
}

function guideInsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });

  return { insert, select, single };
}

function guideUpdateQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });

  return { eq, select, single, update };
}

function guideDeleteQuery(result: { error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const deleteMock = vi.fn().mockReturnValue({ eq });

  return { delete: deleteMock, eq };
}

function fromQueue(queues: Record<string, unknown[]>) {
  return vi.fn((table: string) => {
    const queue = queues[table];

    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected Supabase table call: ${table}`);
    }

    return queue.shift();
  });
}

function authSupabase(supabase: unknown) {
  assertHomeConfigAdminMock.mockResolvedValue({
    ok: true,
    supabase,
  } as Awaited<ReturnType<typeof assertHomeConfigAdmin>>);
}

describe("admin guides route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBearerTokenMock.mockReturnValue("token");
  });

  it("creates a guide with a server-generated unique slug and revalidates guide pages", async () => {
    const slugQuery = guideListQuery({
      data: [{ id: "other-guide", slug: "pool-villa-pattaya" }],
      error: null,
    });
    const insertQuery = guideInsertQuery({ data: dbRow, error: null });
    const from = fromQueue({ guide_posts: [slugQuery, insertQuery] });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/guides/route");
    const response = await PUT(jsonRequest("PUT", { guide: validGuide }));

    expect(response.status).toBe(200);
    expect(insertQuery.insert).toHaveBeenCalledWith({
      slug: "pool-villa-pattaya-2",
      title: "Pool Villa Pattaya",
      excerpt: "Guide excerpt",
      cover_image_path: "guides/2026/06/cover.webp",
      cover_image_url: "https://cdn.example.com/cover.webp",
      cover_image_alt: "Pool villa cover",
      content_blocks: dbRow.content_blocks,
      tags: ["pattaya"],
      recommended_house_ids: ["66"],
      status: "published",
      is_pinned: true,
      published_at: expect.any(String),
    });
    await expect(response.json()).resolves.toMatchObject({
      guide: {
        id: "guide-1",
        slug: "pool-villa-pattaya-2",
        recommendedHouseIds: ["66"],
      },
    });
    expect(revalidateGuideCacheMock).toHaveBeenCalledWith("pool-villa-pattaya-2");
    expect(jsonErrorMock).not.toHaveBeenCalled();
  });

  it("updates an existing guide and revalidates the old and new slugs", async () => {
    const slugQuery = guideListQuery({
      data: [
        { id: "guide-1", slug: "old-guide" },
        { id: "other-guide", slug: "pool-villa-pattaya" },
      ],
      error: null,
    });
    const updateQuery = guideUpdateQuery({
      data: { ...dbRow, id: "guide-1" },
      error: null,
    });
    const from = fromQueue({ guide_posts: [slugQuery, updateQuery] });

    authSupabase({ from });

    const { PUT } = await import("../../../app/(admin)/api/admin/guides/route");
    const response = await PUT(
      jsonRequest("PUT", {
        guide: {
          ...validGuide,
          id: "guide-1",
          slug: "old-guide",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "guide-1");
    expect(revalidateGuideCacheMock).toHaveBeenCalledWith("old-guide");
    expect(revalidateGuideCacheMock).toHaveBeenCalledWith("pool-villa-pattaya-2");
  });

  it("rejects invalid guide drafts before saving", async () => {
    authSupabase({ from: vi.fn() });

    const { PUT } = await import("../../../app/(admin)/api/admin/guides/route");
    const response = await PUT(
      jsonRequest("PUT", {
        guide: {
          ...validGuide,
          title: "",
          coverImage: null,
          contentBlocks: [],
        },
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors).toContain("ต้องใส่ชื่อบทความ");
    expect(body.errors).toContain("บทความที่เผยแพร่ต้องมีรูปปก");
  });

  it("deletes a guide by id and revalidates its slug", async () => {
    const deleteQuery = guideDeleteQuery({ error: null });
    const from = fromQueue({ guide_posts: [deleteQuery] });

    authSupabase({ from });

    const { DELETE } = await import("../../../app/(admin)/api/admin/guides/route");
    const response = await DELETE(
      jsonRequest("DELETE", {
        id: "guide-1",
        slug: "pool-villa-pattaya",
      }),
    );

    expect(response.status).toBe(200);
    expect(deleteQuery.eq).toHaveBeenCalledWith("id", "guide-1");
    expect(revalidateGuideCacheMock).toHaveBeenCalledWith("pool-villa-pattaya");
  });
});
