import type { GuideDraft, GuideImage, GuidePostRow, GuideStatus } from "@/lib/guides/types";
import {
  buildUniqueSlug,
  createSlugFromTitle,
  normalizeGuideDraftForSave,
  normalizeGuidePostRow,
  validateGuideDraft,
} from "@/lib/guides/validation";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import type { HomeConfigSupabaseClient } from "@/lib/admin/route-helpers";
import { revalidateGuideCache } from "@/lib/cache-revalidation";

const GUIDE_POST_SELECT =
  "id,slug,title,excerpt,cover_image_path,cover_image_url,cover_image_alt,content_blocks,tags,recommended_house_ids,status,is_pinned,published_at,created_at,updated_at";

interface GuideSlugRow {
  id: unknown;
  slug: unknown;
}

type AdminGuideDraft = GuideDraft & { id?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : ""))
    : [];
}

function readCoverImage(value: unknown): GuideImage | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return {
      alt: "",
      path: "",
      url: "",
    };
  }

  return {
    alt: readString(value.alt),
    path: readString(value.path),
    url: readString(value.url),
  };
}

function readGuidePayload(payload: unknown):
  | {
      guide: AdminGuideDraft;
      errors: [];
    }
  | {
      guide: null;
      errors: string[];
    } {
  if (!isRecord(payload) || !isRecord(payload.guide)) {
    return { guide: null, errors: ["Body must contain a guide object."] };
  }

  const guide = payload.guide;

  return {
    guide: {
      id: readString(guide.id) || undefined,
      title: readString(guide.title),
      slug: readString(guide.slug),
      excerpt: readString(guide.excerpt),
      coverImage: readCoverImage(guide.coverImage),
      contentBlocks: Array.isArray(guide.contentBlocks) ? guide.contentBlocks : [],
      tags: readStringArray(guide.tags),
      recommendedHouseIds: readStringArray(guide.recommendedHouseIds),
      status: readString(guide.status) as GuideStatus,
      isPinned: guide.isPinned === true,
      publishedAt: guide.publishedAt === null ? null : readString(guide.publishedAt),
    },
    errors: [],
  };
}

async function readJsonPayload(request: Request): Promise<
  | {
      ok: true;
      payload: unknown;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  try {
    return { ok: true, payload: await request.json() };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { errors: ["Request body must be JSON."] },
        { status: 400 },
      ),
    };
  }
}

function mapToSaveRow(guide: GuideDraft) {
  const normalizedGuide = normalizeGuideDraftForSave(guide);
  const publishedAt =
    normalizedGuide.status === "published"
      ? normalizedGuide.publishedAt ?? new Date().toISOString()
      : null;

  return {
    slug: normalizedGuide.slug,
    title: normalizedGuide.title,
    excerpt: normalizedGuide.excerpt,
    cover_image_path: normalizedGuide.coverImage?.path ?? null,
    cover_image_url: normalizedGuide.coverImage?.url ?? null,
    cover_image_alt: normalizedGuide.coverImage?.alt ?? null,
    content_blocks: normalizedGuide.contentBlocks,
    tags: normalizedGuide.tags,
    recommended_house_ids: normalizedGuide.recommendedHouseIds,
    status: normalizedGuide.status,
    is_pinned: normalizedGuide.isPinned,
    published_at: publishedAt,
  };
}

function mapSlugRows(rows: unknown): { id: string; slug: string }[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return (rows as GuideSlugRow[])
    .filter((row) => typeof row.id === "string" && typeof row.slug === "string")
    .map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
    }));
}

async function loadSlugRows(supabase: HomeConfigSupabaseClient) {
  const { data, error } = await supabase.from("guide_posts").select("id,slug");

  if (error) {
    return { rows: [], error };
  }

  return { rows: mapSlugRows(data), error: null };
}

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const { data, error } = await admin.supabase
    .from("guide_posts")
    .select(GUIDE_POST_SELECT)
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    return adminSupabaseErrorResponse(error, "Unable to load guide posts.");
  }

  return Response.json({
    guides: (data as GuidePostRow[]).map(normalizeGuidePostRow),
  });
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const jsonPayload = await readJsonPayload(request);

  if (!jsonPayload.ok) {
    return jsonPayload.response;
  }

  const parsedPayload = readGuidePayload(jsonPayload.payload);

  if (parsedPayload.errors.length > 0 || !parsedPayload.guide) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const guideId = parsedPayload.guide.id?.trim();
  const baseSlug = createSlugFromTitle(parsedPayload.guide.title);
  const preflightDraft: GuideDraft = {
    ...parsedPayload.guide,
    slug: baseSlug,
    publishedAt:
      parsedPayload.guide.status === "published"
        ? parsedPayload.guide.publishedAt ?? new Date().toISOString()
        : null,
  };
  const errors = validateGuideDraft(preflightDraft);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const slugResult = await loadSlugRows(admin.supabase);

  if (slugResult.error) {
    return adminSupabaseErrorResponse(slugResult.error, "Unable to load guide slugs.");
  }

  const currentSlug =
    (guideId
      ? slugResult.rows.find((row) => row.id === guideId)?.slug
      : undefined) ?? parsedPayload.guide.slug.trim();
  const uniqueSlug = buildUniqueSlug(
    baseSlug,
    slugResult.rows.map((row) => row.slug),
    currentSlug || undefined,
  );
  const saveRow = mapToSaveRow({
    ...parsedPayload.guide,
    slug: uniqueSlug,
    publishedAt: preflightDraft.publishedAt,
  });
  const saveQuery = guideId
    ? admin.supabase
        .from("guide_posts")
        .update(saveRow)
        .eq("id", guideId)
        .select(GUIDE_POST_SELECT)
        .single()
    : admin.supabase
        .from("guide_posts")
        .insert(saveRow)
        .select(GUIDE_POST_SELECT)
        .single();
  const { data, error } = await saveQuery;

  if (error || !data) {
    return adminSupabaseErrorResponse(error, "Unable to save guide post.");
  }

  if (currentSlug && currentSlug !== saveRow.slug) {
    revalidateGuideCache(currentSlug);
  }

  revalidateGuideCache(saveRow.slug);

  return Response.json({
    guide: normalizeGuidePostRow(data as GuidePostRow),
  });
}

export async function DELETE(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const jsonPayload = await readJsonPayload(request);

  if (!jsonPayload.ok) {
    return jsonPayload.response;
  }

  const payload = jsonPayload.payload;

  if (!isRecord(payload) || typeof payload.id !== "string") {
    return Response.json({ errors: ["Body must contain a guide id."] }, { status: 400 });
  }

  const slug = typeof payload.slug === "string" ? payload.slug : null;
  const { error } = await admin.supabase
    .from("guide_posts")
    .delete()
    .eq("id", payload.id);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to delete guide post.");
  }

  revalidateGuideCache(slug);

  return Response.json({ ok: true });
}
