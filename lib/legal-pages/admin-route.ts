import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { revalidateLegalPageCache } from "@/lib/cache-revalidation";
import { LEGAL_PAGE_DEFAULTS } from "./defaults";
import type {
  LegalPage,
  LegalPageDraft,
  LegalPageRow,
  LegalPageSlug,
} from "./types";
import { LEGAL_PAGE_SLUGS } from "./types";
import {
  isLegalPageSlug,
  normalizeLegalPageDraftForSave,
  normalizeLegalPageRow,
  validateLegalPageDraft,
} from "./validation";

export const LEGAL_PAGE_SELECT =
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

export async function readJsonPayload(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function readLegalPagePayload(payload: unknown): ParsedLegalPagePayload {
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

export function isValidLegalPageRow(row: unknown): row is LegalPageRow {
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

export function mapLegalPageRowsToAdminList(rows: unknown[]): LegalPage[] {
  const pagesBySlug = new Map<LegalPageSlug, LegalPage>();

  rows.forEach((row) => {
    if (!isValidLegalPageRow(row)) {
      return;
    }

    const normalizedPage = normalizeLegalPageRow(row);
    pagesBySlug.set(normalizedPage.slug, normalizedPage);
  });

  return LEGAL_PAGE_SLUGS.map((slug) =>
    pagesBySlug.get(slug) ?? LEGAL_PAGE_DEFAULTS[slug],
  );
}

export function buildLegalPageSaveRow(normalizedDraft: LegalPageDraft) {
  const publishDate = normalizedDraft.status === "published"
    ? normalizedDraft.publishedAt || new Date().toISOString()
    : null;

  return {
    slug: normalizedDraft.slug,
    title: normalizedDraft.title,
    seo_description: normalizedDraft.seoDescription,
    content_blocks: normalizedDraft.contentBlocks,
    status: normalizedDraft.status,
    published_at: publishDate,
  };
}

export async function buildAdminLegalPagesResponse(
  supabase: HomeConfigSupabaseClient,
) {
  const { data, error } = await supabase
    .from("legal_pages")
    .select(LEGAL_PAGE_SELECT);

  if (error || !Array.isArray(data)) {
    return adminSupabaseErrorResponse(error, "Unable to load legal pages.");
  }

  return Response.json({ legalPages: mapLegalPageRowsToAdminList(data) });
}

export async function saveAdminLegalPage(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
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

  const { data, error } = await supabase
    .from("legal_pages")
    .upsert(buildLegalPageSaveRow(normalizedDraft), { onConflict: "slug" })
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
