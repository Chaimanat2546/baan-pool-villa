import type {
  LegalPage,
  LegalPageDraft,
  LegalPageRow,
  LegalPageSlug,
} from "@/lib/legal-pages/types";
import { LEGAL_PAGE_SLUGS } from "@/lib/legal-pages/types";
import { LEGAL_PAGE_DEFAULTS } from "@/lib/legal-pages/defaults";
import {
  isLegalPageSlug,
  normalizeLegalPageDraftForSave,
  normalizeLegalPageRow,
  validateLegalPageDraft,
} from "@/lib/legal-pages/validation";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateLegalPageCache } from "@/lib/cache-revalidation";

const LEGAL_PAGE_SELECT =
  "id,slug,title,seo_description,content_blocks,status,published_at,created_at,updated_at";

interface IncomingLegalPagePayload {
  slug: string;
  title: string;
  seoDescription: string;
  contentBlocks: unknown;
  status: string;
  publishedAt: string | null;
}

interface ParsedLegalPagePayload {
  legalPage: IncomingLegalPagePayload | null;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullablePublishedAt(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  return toString(value);
}

async function readJsonPayload(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function readLegalPagePayload(payload: unknown): ParsedLegalPagePayload {
  if (!isRecord(payload) || !isRecord(payload.legalPage)) {
    return { legalPage: null, errors: ["Body must contain a legalPage object."] };
  }

  const legalPage = payload.legalPage;

  return {
    legalPage: {
      slug: toString(legalPage.slug),
      title: toString(legalPage.title),
      seoDescription: toString(legalPage.seoDescription),
      contentBlocks: legalPage.contentBlocks,
      status: toString(legalPage.status),
      publishedAt: toNullablePublishedAt(legalPage.publishedAt),
    },
    errors: [],
  };
}

function isValidLegalPageRow(row: unknown): row is LegalPageRow {
  return (
    isRecord(row) &&
    typeof row.id === "string" &&
    isLegalPageSlug(row.slug) &&
    typeof row.title === "string" &&
    (typeof row.seo_description === "string" || row.seo_description === null) &&
    (typeof row.status === "string" || row.status === null) &&
    (typeof row.published_at === "string" || row.published_at === null) &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string"
  );
}

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await admin.supabase
    .from("legal_pages")
    .select(LEGAL_PAGE_SELECT);

  if (error || !Array.isArray(data)) {
    return adminSupabaseErrorResponse(error, "Unable to load legal pages.");
  }

  const pagesBySlug = new Map<LegalPageSlug, LegalPage>();

  data.forEach((row) => {
    if (!isValidLegalPageRow(row)) {
      return;
    }

    const normalizedPage = normalizeLegalPageRow(row);
    pagesBySlug.set(normalizedPage.slug, normalizedPage);
  });

  const legalPages = LEGAL_PAGE_SLUGS.map((slug) =>
    pagesBySlug.get(slug) ?? LEGAL_PAGE_DEFAULTS[slug],
  );

  return Response.json({ legalPages });
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const parsedPayload = readLegalPagePayload(await readJsonPayload(request));

  if (parsedPayload.errors.length > 0 || !parsedPayload.legalPage) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const normalizedDraft = normalizeLegalPageDraftForSave(
    parsedPayload.legalPage as LegalPageDraft,
  );
  const errors = validateLegalPageDraft(normalizedDraft);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const publishDate = normalizedDraft.status === "published"
    ? normalizedDraft.publishedAt || new Date().toISOString()
    : null;

  const { data, error } = await admin.supabase
    .from("legal_pages")
    .upsert(
      {
        slug: normalizedDraft.slug,
        title: normalizedDraft.title,
        seo_description: normalizedDraft.seoDescription,
        content_blocks: normalizedDraft.contentBlocks,
        status: normalizedDraft.status,
        published_at: publishDate,
      },
      { onConflict: "slug" },
    )
    .select(LEGAL_PAGE_SELECT)
    .single();

  if (error || !data) {
    return adminSupabaseErrorResponse(error, "Unable to save legal page.");
  }

  if (!isValidLegalPageRow(data)) {
    return Response.json({ error: "Unable to save legal page." }, { status: 502 });
  }

  const normalizedPage = normalizeLegalPageRow(data);
  await revalidateLegalPageCache(normalizedPage.slug);

  return Response.json({
    legalPage: normalizedPage,
  });
}
