import type { GuideDraft, GuidePostRow } from "@/lib/guides/types";
import {
  buildUniqueSlug,
  createSlugFromTitle,
  normalizeGuidePostRow,
  validateGuideDraft,
} from "@/lib/guides/validation";
import {
  GUIDE_POST_SELECT,
  loadSlugRows,
  mapToSaveRow,
  readDeleteGuidePayload,
  readGuidePayload,
  readJsonPayload,
} from "@/lib/guides/admin-route";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateGuideCache } from "@/lib/cache-revalidation";

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
    await revalidateGuideCache(currentSlug);
  }

  await revalidateGuideCache(saveRow.slug);

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

  const parsedPayload = readDeleteGuidePayload(jsonPayload.payload);

  if (parsedPayload.errors.length > 0 || !parsedPayload.id) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const { error } = await admin.supabase
    .from("guide_posts")
    .delete()
    .eq("id", parsedPayload.id);

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to delete guide post.");
  }

  await revalidateGuideCache(parsedPayload.slug);

  return Response.json({ ok: true });
}
