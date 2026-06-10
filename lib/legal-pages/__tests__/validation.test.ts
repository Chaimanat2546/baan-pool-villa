import { describe, expect, it } from "vitest";

import type { LegalPageDraft, LegalPageRow } from "@/lib/legal-pages/types";
import {
  isLegalPageSlug,
  normalizeLegalPageDraftForSave,
  normalizeLegalPageRow,
  validateLegalPageDraft,
} from "@/lib/legal-pages/validation";

const validDraft = (overrides: Partial<LegalPageDraft> = {}): LegalPageDraft => ({
  slug: "terms",
  title: "Terms and conditions",
  seoDescription: "A short summary for terms and conditions.",
  contentBlocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Welcome to our terms." }],
    },
  ],
  status: "draft",
  publishedAt: null,
  ...overrides,
});

describe("legal page validation", () => {
  it("accepts only fixed legal slugs", () => {
    expect(isLegalPageSlug("terms")).toBe(true);
    expect(isLegalPageSlug("privacy")).toBe(true);
    expect(isLegalPageSlug("refund")).toBe(false);
  });

  it("requires title and content before publishing", () => {
    expect(
      validateLegalPageDraft({
        ...validDraft(),
        title: "",
        seoDescription: "",
        contentBlocks: [],
        status: "published",
        publishedAt: null,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("title"),
        expect.stringContaining("at least one"),
      ]),
    );
  });

  it("normalizes rows to safe public legal pages", () => {
    const page = normalizeLegalPageRow({
      id: "legal-terms",
      slug: "terms",
      title: " Terms ",
      seo_description: " Terms summary ",
      content_blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "A" }],
        },
      ],
      status: "published",
      published_at: "2026-06-10T00:00:00.000Z",
      created_at: "2026-06-09T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
    });

    expect(page.slug).toBe("terms");
    expect(page.title).toBe("Terms");
    expect(page.seoDescription).toBe("Terms summary");
    expect(page.status).toBe("published");
  });
});

describe("normalizeLegalPageDraftForSave", () => {
  it("trims fields and clears publishedAt for draft", () => {
    const draft = validDraft({
      title: "  Terms and conditions  ",
      seoDescription: "  Summary text  ",
      status: "draft",
      publishedAt: "2026-06-10T00:00:00.000Z",
    });

    const normalized = normalizeLegalPageDraftForSave(draft);

    expect(normalized.title).toBe("Terms and conditions");
    expect(normalized.seoDescription).toBe("Summary text");
    expect(normalized.publishedAt).toBeNull();
  });

  it("keeps invalid slug/status values so validation can reject them", () => {
    const draft = validDraft({
      slug: "refund",
      status: "published",
    } as unknown as LegalPageDraft);
    const normalized = normalizeLegalPageDraftForSave(draft);

    expect(normalized.slug).toBe("refund");
    expect(normalized.status).toBe("published");
  });

  it("does not change malformed payloads into a valid saved draft", () => {
    const invalidDraft = {
      slug: "refund",
      title: "Terms and conditions",
      seoDescription: "A short summary for terms and conditions.",
      contentBlocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Welcome to our terms." }],
        },
      ],
      status: "archived",
      publishedAt: null,
    } as unknown as LegalPageDraft;

    const normalized = normalizeLegalPageDraftForSave(invalidDraft);

    expect(validateLegalPageDraft(normalized)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("slug is invalid"),
        expect.stringContaining("status is invalid"),
      ]),
    );
  });
});

describe("normalizeLegalPageRow", () => {
  it("normalizes invalid status to draft", () => {
    const page = normalizeLegalPageRow({
      id: "legal-terms",
      slug: "terms",
      title: "Terms",
      seo_description: "Summary",
      content_blocks: [],
      status: "archived",
      published_at: "2026-06-10T00:00:00.000Z",
      created_at: "2026-06-09T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
    } as LegalPageRow);

    expect(page.status).toBe("draft");
    expect(page.publishedAt).toBeNull();
  });

  it("normalizes malformed content blocks to []", () => {
    const page = normalizeLegalPageRow({
      id: "legal-terms",
      slug: "terms",
      title: "Terms",
      seo_description: "Summary",
      content_blocks: "not-an-array",
      status: "draft",
      published_at: null,
      created_at: "2026-06-09T00:00:00.000Z",
      updated_at: "2026-06-10T00:00:00.000Z",
    } as LegalPageRow);

    expect(page.contentBlocks).toEqual([]);
  });
});

describe("validateLegalPageDraft", () => {
  it("rejects unsupported content block types", () => {
    const errors = validateLegalPageDraft(
      validDraft({
        contentBlocks: [{ type: "image", url: "..." }],
      }),
    );

    expect(errors).toContainEqual(expect.stringContaining("unsupported type"));
  });

  it("validates maximum legal page title length", () => {
    expect(
      validateLegalPageDraft(
        validDraft({
          title: "a".repeat(121),
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("at most 120"),
      ]),
    );
  });

  it("validates maximum legal page SEO description length", () => {
    expect(
      validateLegalPageDraft(
        validDraft({
          seoDescription: "a".repeat(221),
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("at most 220"),
      ]),
    );
  });

  it("rejects unknown draft status and unknown slug values", () => {
    expect(
      validateLegalPageDraft({
        ...validDraft(),
        slug: "refund",
        status: "draft",
      } as unknown as LegalPageDraft),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("slug is invalid")]),
    );
    expect(
      validateLegalPageDraft({
        ...validDraft(),
        slug: "terms",
        status: "archived",
      } as unknown as LegalPageDraft),
    ).toEqual(
      expect.arrayContaining([expect.stringContaining("status is invalid")]),
    );
  });

  it("requires supported non-empty text when publishing", () => {
    expect(
      validateLegalPageDraft(
        validDraft({
          contentBlocks: [{ type: "paragraph", content: [{ type: "text", text: "  " }] }],
          status: "published",
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("at least one text block"),
      ]),
    );
    expect(
      validateLegalPageDraft(
        validDraft({
          contentBlocks: [],
          status: "published",
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("content block"),
      ]),
    );
  });
});
