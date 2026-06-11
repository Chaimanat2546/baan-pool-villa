import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEGAL_PAGE_DEFAULTS } from "@/lib/legal-pages/defaults";
import { revalidateLegalPageCache } from "@/lib/cache-revalidation";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin/route-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/route-helpers")>(
    "@/lib/admin/route-helpers",
  );

  return {
    ...actual,
    requireHomeConfigAdmin: vi.fn(),
  };
});

vi.mock("@/lib/cache-revalidation", () => ({
  revalidateLegalPageCache: vi.fn(),
}));

const requireHomeConfigAdminMock = vi.mocked(requireHomeConfigAdmin);
const revalidateLegalPageCacheMock = vi.mocked(revalidateLegalPageCache);

const legalPageRows = [
  {
    id: "terms-live",
    slug: "terms",
    title: " Terms and Conditions ",
    seo_description: " Terms summary for terms. ",
    content_blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Terms content." }],
      },
    ],
    status: "published",
    published_at: "2026-06-10T09:00:00.000Z",
    created_at: "2026-06-10T07:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
  },
];

function jsonRequest(method: string, body?: unknown) {
  return new Request("https://example.com/api/admin/legal-pages", {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    method,
  });
}

function invalidJsonRequest(method: string) {
  return new Request("https://example.com/api/admin/legal-pages", {
    body: "{this-is-not-json",
    headers: {
      authorization: "Bearer token",
      "content-type": "application/json",
    },
    method,
  });
}

function legalPageListQuery(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);

  return { select };
}

function legalPageUpsertQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const upsert = vi.fn().mockReturnValue({ select });

  return { upsert, select, single };
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
  requireHomeConfigAdminMock.mockResolvedValue({
    ok: true,
    supabase,
  } as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
}

function authFailure(
  status = 401,
  error = "Missing bearer token.",
  supabase: unknown = { from: vi.fn() },
) {
  requireHomeConfigAdminMock.mockResolvedValue({
    ok: false,
    response: Response.json({ error }, { status }),
    supabase,
  } as unknown as Awaited<ReturnType<typeof requireHomeConfigAdmin>>);
}

describe("admin legal-pages route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("GET returns normalized rows plus defaults for missing fixed pages in fixed order", async () => {
    const query = legalPageListQuery({
      data: [
        { ...legalPageRows[0], slug: "about-us" },
        legalPageRows[0],
      ],
      error: null,
    });
    const from = fromQueue({ legal_pages: [query] });

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await GET(jsonRequest("GET"));

    expect(response.status).toBe(200);

    expect(await response.json()).toMatchObject({
      legalPages: [
        {
          id: "terms-live",
          slug: "terms",
          title: "Terms and Conditions",
          seoDescription: "Terms summary for terms.",
          status: "published",
          publishedAt: "2026-06-10T09:00:00.000Z",
        },
        {
          id: LEGAL_PAGE_DEFAULTS.privacy.id,
          slug: "privacy",
          title: "Privacy Policy",
        },
      ],
    });

    expect(from).toHaveBeenCalledWith("legal_pages");
    expect(query.select).toHaveBeenCalled();
  });

  it("GET returns structured error metadata when loading legal pages fails", async () => {
    const query = legalPageListQuery({
      data: null,
      error: {
        message: "Unable to load legal page rows.",
        code: "42501",
        details: "policy denied",
        hint: "Check admin permissions.",
        status: 403,
      },
    });
    const from = fromQueue({ legal_pages: [query] });

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await GET(jsonRequest("GET"));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Unable to load legal page rows.",
      code: "42501",
      details: "policy denied",
      hint: "Check admin permissions.",
    });
  });

  it("GET skips malformed truthy rows", async () => {
    const query = legalPageListQuery({
      data: [
        { ...legalPageRows[0], id: 123, slug: "terms", title: "Terms", created_at: 123 },
        { ...legalPageRows[0], slug: "privacy", created_at: 123, updated_at: 456 },
      ],
      error: null,
    });
    const from = fromQueue({ legal_pages: [query] });

    authSupabase({ from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await GET(jsonRequest("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      legalPages: [
        LEGAL_PAGE_DEFAULTS.terms,
        LEGAL_PAGE_DEFAULTS.privacy,
      ],
    });
  });

  it("PUT saves a published legal page with trimmed fields and cached revalidation", async () => {
    const upsertQuery = legalPageUpsertQuery({
      data: {
        id: "terms-live",
        slug: "terms",
        title: "Terms and Conditions",
        seo_description: "Updated terms summary.",
        content_blocks: [
          { type: "paragraph", content: [{ type: "text", text: "Updated terms." }] },
        ],
        status: "published",
        published_at: "2026-06-10T10:00:00.000Z",
        created_at: "2026-06-10T07:00:00.000Z",
        updated_at: "2026-06-10T10:00:00.000Z",
      },
      error: null,
    });
    const from = fromQueue({ legal_pages: [upsertQuery] });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        legalPage: {
          slug: "terms",
          title: "  Terms and Conditions  ",
          seoDescription: "  Updated terms summary.  ",
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
          status: "published",
          publishedAt: null,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      {
        slug: "terms",
        title: "Terms and Conditions",
        seo_description: "Updated terms summary.",
        content_blocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
        status: "published",
        published_at: expect.any(String),
      },
      { onConflict: "slug" },
    );
    expect(await response.json()).toMatchObject({
      legalPage: {
        id: "terms-live",
        slug: "terms",
        title: "Terms and Conditions",
        seoDescription: "Updated terms summary.",
        status: "published",
      },
    });
    expect(revalidateLegalPageCacheMock).toHaveBeenCalledWith("terms");
  });

  it("PUT rejects invalid JSON before persistence or revalidation", async () => {
    authSupabase({ from: vi.fn() });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(invalidJsonRequest("PUT"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: ["Body must contain a legalPage object."],
    });
    expect(revalidateLegalPageCacheMock).not.toHaveBeenCalled();
  });

  it("PUT rejects missing legalPage object before persistence or revalidation", async () => {
    authSupabase({ from: vi.fn() });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        notLegalPage: {
          title: "Terms and Conditions",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: ["Body must contain a legalPage object."],
    });
    expect(revalidateLegalPageCacheMock).not.toHaveBeenCalled();
  });

  it("preserves Supabase error metadata and status on save failures", async () => {
    const supabaseError = {
      message: "Access denied.",
      code: "42501",
      details: "Row level security denied",
      hint: "Check admin role grants.",
    };
    const upsertQuery = legalPageUpsertQuery({ data: null, error: supabaseError });
    const from = fromQueue({ legal_pages: [upsertQuery] });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        legalPage: {
          slug: "terms",
          title: "Terms and Conditions",
          seoDescription: "Updated terms summary.",
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
          status: "published",
          publishedAt: "2026-06-10T10:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "Access denied.",
      code: "42501",
      details: "Row level security denied",
      hint: "Check admin role grants.",
    });
    expect(revalidateLegalPageCacheMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid legal page slug and status and does not persist", async () => {
    const upsertQuery = legalPageUpsertQuery({
      data: legalPageRows[0],
      error: null,
    });
    const from = fromQueue({ legal_pages: [upsertQuery] });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        legalPage: {
          slug: "not-a-page",
          title: "Terms and Conditions",
          seoDescription: "Updated terms summary.",
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
          status: "archived",
          publishedAt: "2026-06-10T10:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: expect.arrayContaining([
        expect.stringContaining("Slug ของหน้ากฎหมายไม่ถูกต้อง"),
        expect.stringContaining("สถานะหน้ากฎหมายไม่ถูกต้อง"),
      ]),
    });
    expect(revalidateLegalPageCacheMock).not.toHaveBeenCalled();
    expect(upsertQuery.upsert).not.toHaveBeenCalled();
  });

  it("draft saves publishedAt as null even when payload includes a publishedAt value", async () => {
    const upsertQuery = legalPageUpsertQuery({
      data: {
        ...legalPageRows[0],
        status: "draft",
        published_at: null,
      },
      error: null,
    });
    const from = fromQueue({ legal_pages: [upsertQuery] });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        legalPage: {
          slug: "terms",
          title: "  Terms and Conditions  ",
          seoDescription: "  Updated terms summary.  ",
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
          status: "draft",
          publishedAt: "2026-06-10T10:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        published_at: null,
      }),
      { onConflict: "slug" },
    );
  });

  it("returns malformed saved rows as a controlled 502 response and does not revalidate", async () => {
    const upsertQuery = legalPageUpsertQuery({
      data: { ...legalPageRows[0], created_at: 123 },
      error: null,
    });
    const from = fromQueue({ legal_pages: [upsertQuery] });

    authSupabase({ from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        legalPage: {
          slug: "terms",
          title: "  Terms and Conditions  ",
          seoDescription: "  Updated terms summary.  ",
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
          status: "published",
          publishedAt: "2026-06-10T10:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "Unable to save legal page.",
    });
    expect(revalidateLegalPageCacheMock).not.toHaveBeenCalled();
    expect(upsertQuery.upsert).toHaveBeenCalled();
  });

  it("does not query legal pages on GET auth failure", async () => {
    const from = vi.fn();
    authFailure(401, "Missing bearer token.", { from });

    const { GET } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await GET(jsonRequest("GET"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: "Missing bearer token." });
    expect(from).not.toHaveBeenCalled();
  });

  it("does not persist legal page data on PUT auth failure", async () => {
    const from = vi.fn();
    authFailure(401, "Missing bearer token.", { from });

    const { PUT } = await import(
      "../../../app/(admin)/api/admin/legal-pages/route"
    );
    const response = await PUT(
      jsonRequest("PUT", {
        legalPage: {
          slug: "terms",
          title: "Terms and Conditions",
          seoDescription: "Updated terms summary.",
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "Updated terms." }] }],
          status: "published",
          publishedAt: "2026-06-10T10:00:00.000Z",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
});
