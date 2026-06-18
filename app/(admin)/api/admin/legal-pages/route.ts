import type { LegalPageDraft } from "@/lib/legal-pages/types";
import {
  normalizeLegalPageDraftForSave,
  normalizeLegalPageRow,
  validateLegalPageDraft,
} from "@/lib/legal-pages/validation";
import {
  buildLegalPageSaveRow,
  isValidLegalPageRow,
  LEGAL_PAGE_SELECT,
  mapLegalPageRowsToAdminList,
  readJsonPayload,
  readLegalPagePayload,
} from "@/lib/legal-pages/admin-route";
import {
  adminSupabaseErrorResponse,
  requireHomeConfigAdmin,
} from "@/lib/admin/route-helpers";
import { revalidateLegalPageCache } from "@/lib/cache-revalidation";

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

  return Response.json({ legalPages: mapLegalPageRowsToAdminList(data) });
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

  const { data, error } = await admin.supabase
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
