import { revalidateHomeSectionsCache } from "@/lib/cache-revalidation";
import {
  normalizeHomeSectionDraftsForSave,
  validateHomeSectionDrafts,
} from "@/lib/home-sections/validation";
import {
  HOME_SECTIONS_ADMIN_SELECT,
  mapHomeSectionRow,
  mapSavedHomeSectionPayload,
  parseSectionsPayload,
  toRpcPayload,
  type HomeSectionRow,
} from "@/lib/home-sections/admin-route";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";

import { jsonError } from "./auth";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const supabase = admin.supabase;

  const { data, error } = await supabase
    .from("home_sections")
    .select(HOME_SECTIONS_ADMIN_SELECT)
    .order("display_order", { ascending: true })
    .order("position", {
      ascending: true,
      referencedTable: "home_section_items",
    });

  if (error || !Array.isArray(data)) {
    return adminSupabaseErrorResponse(error, "Unable to load home sections.");
  }

  try {
    return Response.json({
      sections: (data as HomeSectionRow[]).map(mapHomeSectionRow),
    });
  } catch (error) {
    return jsonError("Invalid home section data.", 500, {
      details:
        error instanceof Error ? error.message : "Unable to map home section row.",
    });
  }
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const supabase = admin.supabase;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const parsedPayload = parseSectionsPayload(payload);

  if (parsedPayload.errors.length > 0) {
    return Response.json({ errors: parsedPayload.errors }, { status: 400 });
  }

  const sections = parsedPayload.sections;
  const errors = validateHomeSectionDrafts(sections);

  if (errors.length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const normalizedSections = normalizeHomeSectionDraftsForSave(sections);
  const rpcPayload = toRpcPayload(normalizedSections);
  const { error } = await supabase.rpc("save_home_section_snapshot", {
    snapshot: rpcPayload,
  });

  if (error) {
    return adminSupabaseErrorResponse(error, "Unable to save home sections.");
  }

  await revalidateHomeSectionsCache();

  return Response.json({
    sections: rpcPayload.map(mapSavedHomeSectionPayload),
  });
}
