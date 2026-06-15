import { beforeEach, describe, expect, it, vi } from "vitest";

import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-policy";
import { LEGAL_PAGE_DEFAULTS } from "../defaults";
import {
  getLegalPageBySlug,
  getPublishedLegalPages,
  getPublishedLegalPagesForSitemap,
} from "../server";
import { createHomeConfigClient } from "../../home-sections/supabase";
import { unstable_cache } from "next/cache";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("../../home-sections/supabase", () => ({
  createHomeConfigClient: vi.fn(),
}));

const createHomeConfigClientMock = vi.mocked(createHomeConfigClient);
const unstableCacheMock = vi.mocked(unstable_cache);

const basePublishedLegalPageRow = {
  id: "legal-terms-1",
  slug: "terms",
  title: " Terms and conditions ",
  seo_description: " Terms summary ",
  content_blocks: [
    { type: "paragraph", content: [{ type: "text", text: "Terms." }] },
  ],
  status: "published",
  published_at: "2026-06-10T00:00:00.000Z",
  created_at: "2026-06-09T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
};

const baseDraftLegalPageRow = {
  ...basePublishedLegalPageRow,
  id: "legal-terms-2",
  status: "draft",
};

const baseInvalidSlugLegalPageRow = {
  ...basePublishedLegalPageRow,
  id: "legal-invalid",
  slug: "about-us",
  title: " Bad terms row ",
};

function mockLegalPageDetailQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const slugEq = vi.fn().mockReturnValue({ maybeSingle });
  const statusEq = vi.fn().mockReturnValue({ eq: slugEq });
  const select = vi.fn().mockReturnValue({ eq: statusEq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { from, maybeSingle, select, slugEq, statusEq };
}

function mockLegalPageListQuery(result: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createHomeConfigClientMock.mockReturnValue({
    from,
  } as ReturnType<typeof createHomeConfigClient>);

  return { from, select, eq };
}

beforeEach(() => {
  createHomeConfigClientMock.mockClear();
});

describe("getLegalPageBySlug", () => {
  it("selects a published legal page by slug and caches by slug", async () => {
    const query = mockLegalPageDetailQuery({ data: basePublishedLegalPageRow, error: null });

    await expect(getLegalPageBySlug("terms")).resolves.toMatchObject({
      id: "legal-terms-1",
      slug: "terms",
      title: "Terms and conditions",
      seoDescription: "Terms summary",
      status: "published",
      publishedAt: "2026-06-10T00:00:00.000Z",
    });

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.legalPage("terms")],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.legalPages,
        tags: [CACHE_TAGS.legalPages, CACHE_TAGS.legalPage("terms")],
      },
    );

    expect(query.from).toHaveBeenCalledWith("legal_pages");
    expect(query.statusEq).toHaveBeenCalledWith("status", "published");
    expect(query.slugEq).toHaveBeenCalledWith("slug", "terms");
  });

  it("falls back to defaults when the published row is missing", async () => {
    mockLegalPageDetailQuery({ data: null, error: null });

    await expect(getLegalPageBySlug("privacy")).resolves.toEqual(
      LEGAL_PAGE_DEFAULTS.privacy,
    );
  });

  it("falls back to defaults when legal page config errors", async () => {
    mockLegalPageDetailQuery({ data: null, error: { message: "RLS denied" } });

    await expect(getLegalPageBySlug("privacy")).resolves.toEqual(
      LEGAL_PAGE_DEFAULTS.privacy,
    );
  });

  it("falls back to defaults when the cached call reports a config error", async () => {
    const query = mockLegalPageDetailQuery({
      data: null,
      error: { message: "config is missing" },
    });

    await expect(getLegalPageBySlug("terms")).resolves.toEqual(
      LEGAL_PAGE_DEFAULTS.terms,
    );

    await expect(getLegalPageBySlug("terms")).resolves.toEqual(
      LEGAL_PAGE_DEFAULTS.terms,
    );

    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
  });
});

describe("getPublishedLegalPages", () => {
  it("wraps the collection read in a tagged Next cache", async () => {
    mockLegalPageListQuery({ data: [], error: null });

    await getPublishedLegalPages();

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.legalPages],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.legalPages,
        tags: [CACHE_TAGS.legalPages],
      },
    );
  });

  it("wraps sitemap legal page reads in a twenty-four-hour tagged Next cache", async () => {
    mockLegalPageListQuery({ data: [], error: null });

    await getPublishedLegalPagesForSitemap();

    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      [CACHE_TAGS.legalPages, "sitemap"],
      {
        revalidate: CACHE_REVALIDATE_SECONDS.sitemap,
        tags: [CACHE_TAGS.legalPages],
      },
    );
  });

  it("returns both fixed pages in [terms, privacy] order, merging DB rows with defaults", async () => {
    const privacyRow = {
      ...basePublishedLegalPageRow,
      id: "legal-privacy-1",
      slug: "privacy",
      title: " Privacy policy ",
      seo_description: " Privacy summary ",
      published_at: null,
      created_at: "2026-06-08T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
    };

    const query = mockLegalPageListQuery({
      data: [basePublishedLegalPageRow, privacyRow],
      error: null,
    });

    await expect(getPublishedLegalPages()).resolves.toEqual([
      {
        id: "legal-terms-1",
        slug: "terms",
        title: "Terms and conditions",
        seoDescription: "Terms summary",
        contentBlocks: [
          { type: "paragraph", content: [{ type: "text", text: "Terms." }] },
        ],
        status: "published",
        publishedAt: "2026-06-10T00:00:00.000Z",
        createdAt: "2026-06-09T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      {
        id: "legal-privacy-1",
        slug: "privacy",
        title: "Privacy policy",
        seoDescription: "Privacy summary",
        contentBlocks: [
          { type: "paragraph", content: [{ type: "text", text: "Terms." }] },
        ],
        status: "published",
        publishedAt: null,
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
    ]);

    expect(query.from).toHaveBeenCalledWith("legal_pages");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
  });

  it("returns defaults when rows are missing, malformed, or the query fails", async () => {
    const query = mockLegalPageListQuery({
      data: [baseDraftLegalPageRow],
      error: null,
    });

    await expect(getPublishedLegalPages()).resolves.toEqual([
      LEGAL_PAGE_DEFAULTS.terms,
      LEGAL_PAGE_DEFAULTS.privacy,
    ]);

    expect(query.eq).toHaveBeenCalledWith("status", "published");

    const failingQuery = mockLegalPageListQuery({
      data: null,
      error: { message: "RLS denied" },
    });

    await expect(getPublishedLegalPages()).resolves.toEqual([
      LEGAL_PAGE_DEFAULTS.terms,
      LEGAL_PAGE_DEFAULTS.privacy,
    ]);

    expect(failingQuery.eq).toHaveBeenCalledWith("status", "published");
  });

  it("falls back to defaults when collection read throws", async () => {
    const failingQuery = mockLegalPageListQuery({
      data: null,
      error: { message: "RLS denied" },
    });

    await expect(getPublishedLegalPages()).resolves.toEqual([
      LEGAL_PAGE_DEFAULTS.terms,
      LEGAL_PAGE_DEFAULTS.privacy,
    ]);

    expect(failingQuery.eq).toHaveBeenCalledWith("status", "published");
  });

  it("does not expose missing or draft slugs publicly", async () => {
    const query = mockLegalPageListQuery({
      data: [baseDraftLegalPageRow],
      error: null,
    });

    const result = await getPublishedLegalPages();

    expect(result).toEqual([LEGAL_PAGE_DEFAULTS.terms, LEGAL_PAGE_DEFAULTS.privacy]);
    expect(query.from).toHaveBeenCalledWith("legal_pages");
  });

  it("ignores a published row with an invalid raw slug and uses default terms", async () => {
    const query = mockLegalPageListQuery({
      data: [baseInvalidSlugLegalPageRow],
      error: null,
    });

    await expect(getPublishedLegalPages()).resolves.toEqual([
      LEGAL_PAGE_DEFAULTS.terms,
      LEGAL_PAGE_DEFAULTS.privacy,
    ]);

    expect(query.eq).toHaveBeenCalledWith("status", "published");
  });
});
