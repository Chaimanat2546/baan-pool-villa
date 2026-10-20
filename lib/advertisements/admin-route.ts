import "server-only";
import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
  type SupabaseLikeError,
} from "@/lib/admin/route-helpers";
import { revalidateAdvertisementsCache } from "@/lib/cache-revalidation";
import {
  cleanupAdvertisementAssets,
  uploadAdvertisementAssets,
} from "./admin-assets";
import { ADVERTISEMENT_BUCKET, type AdminAdvertisement } from "./types";
import {
  isAdvertisementId,
  isAdvertisementStoragePath,
  isRecord,
  parseAdvertisementDraft,
  validateAdvertisementUpload,
} from "./validation";

const SELECT =
  "id,title,zone,is_active,sort_order,updated_at,site_advertisement_images(id,storage_path,display_order)";
const rejectedTransactionCodes = new Set([
  "40001",
  "22023",
  "22P02",
  "23514",
  "23505",
  "23502",
  "42501",
]);
function invalid(errors: string[]) {
  return Response.json({ errors }, { status: 400 });
}
function mutationError(error: SupabaseLikeError) {
  return error.code === "40001"
    ? Response.json(
        {
          error: "โฆษณาถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกหรือลบ",
          code: error.code,
        },
        { status: 409 },
      )
    : adminSupabaseErrorResponse(error, "บันทึกโฆษณาไม่สำเร็จ");
}
export async function listAdminAdvertisements(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  const rawPage = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^[1-9]\d{0,4}$/.test(rawPage)) return invalid(["เลขหน้าไม่ถูกต้อง"]);
  const page = Number(rawPage),
    pageSize = 20;
  const { data, error, count } = await supabase
    .from("site_advertisements")
    .select(SELECT, { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error)
    return adminSupabaseErrorResponse(
      error,
      "โหลดโฆษณาไม่สำเร็จ กรุณาตรวจสอบการติดตั้งฐานข้อมูลโฆษณาของเว็บนี้",
    );
  const advertisements: AdminAdvertisement[] = [];
  for (const row of data ?? []) {
    if (
      !isAdvertisementId(row.id) ||
      typeof row.title !== "string" ||
      typeof row.updated_at !== "string"
    )
      return invalid(["ข้อมูลโฆษณาในฐานข้อมูลไม่ถูกต้อง"]);
    const images = (
      Array.isArray(row.site_advertisement_images)
        ? row.site_advertisement_images
        : []
    )
      .filter(
        (
          image: unknown,
        ): image is {
          id: string;
          storage_path: string;
          display_order: number;
        } =>
          isRecord(image) &&
          isAdvertisementId(image.id) &&
          isAdvertisementStoragePath(image.storage_path, row.id) &&
          typeof image.display_order === "number",
      )
      .sort((a, b) => a.display_order - b.display_order)
      .map((image) => ({
        id: image.id,
        storagePath: image.storage_path,
        url: supabase.storage
          .from(ADVERTISEMENT_BUCKET)
          .getPublicUrl(image.storage_path).data.publicUrl,
      }));
    advertisements.push({
      id: row.id,
      title: row.title,
      zone: row.zone,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
      images,
    });
  }
  return Response.json({
    advertisements,
    total: count ?? advertisements.length,
    page,
    pageSize,
  });
}

export async function saveAdminAdvertisement(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  let form: FormData, payload: unknown;
  try {
    form = await request.formData();
    payload = JSON.parse(String(form.get("advertisement")));
  } catch {
    return invalid(["รูปแบบข้อมูลโฆษณาไม่ถูกต้อง"]);
  }
  const { draft, errors } = parseAdvertisementDraft(payload);
  if (!draft) return invalid(errors);
  const entries = form.getAll("images");
  const files = entries.filter((entry): entry is File => entry instanceof File);
  const uploadIndexes = draft.images
    .flatMap((image) => ("uploadIndex" in image ? [image.uploadIndex] : []))
    .sort((a, b) => a - b);
  if (
    entries.length !== files.length ||
    files.length !== uploadIndexes.length ||
    uploadIndexes.some((index, position) => index !== position)
  )
    return invalid(["จำนวนไฟล์ไม่ตรงกับรายการรูป กรุณาเลือกรูปใหม่"]);
  const uploadErrors = files.flatMap(validateAdvertisementUpload);
  if (uploadErrors.length) return invalid([...new Set(uploadErrors)]);
  const upload = await uploadAdvertisementAssets(supabase, draft.id, files);
  if (upload.response) return upload.response;
  // Existing ids resolve server-side. Client-supplied paths/URLs are never trusted.
  const retainedIds = draft.images.flatMap((image) =>
    "id" in image ? [image.id] : [],
  );
  let retained: { id: string; storagePath: string }[] = [];
  if (retainedIds.length) {
    const result = await supabase
      .from("site_advertisement_images")
      .select("id,storage_path")
      .eq("advertisement_id", draft.id)
      .in("id", retainedIds);
    if (
      result.error ||
      !result.data ||
      result.data.length !== retainedIds.length
    ) {
      await cleanupAdvertisementAssets(
        supabase,
        upload.assets.map((asset) => asset.storagePath),
      );
      return result.error
        ? adminSupabaseErrorResponse(result.error, "ตรวจสอบรูปเดิมไม่สำเร็จ")
        : invalid(["รูปเดิมไม่อยู่ในโฆษณานี้แล้ว กรุณาโหลดข้อมูลล่าสุด"]);
    }
    retained = result.data.map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
    }));
  }
  const images = draft.images.map((image) =>
    "id" in image
      ? retained.find((asset) => asset.id === image.id)!
      : upload.assets[image.uploadIndex],
  );
  let result;
  try {
    result = await supabase.rpc("save_site_advertisement", {
      p_ad: draft,
      p_images: images,
    });
  } catch {
    return Response.json(
      { error: "ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุดก่อนลองอีกครั้ง" },
      { status: 503 },
    );
  }
  if (result.error) {
    if (result.error.code && rejectedTransactionCodes.has(result.error.code))
      await cleanupAdvertisementAssets(
        supabase,
        upload.assets.map((asset) => asset.storagePath),
      );
    return mutationError(result.error);
  }
  if (
    !isRecord(result.data) ||
    !isAdvertisementId(result.data.id) ||
    typeof result.data.updatedAt !== "string"
  )
    return Response.json(
      { error: "ยังยืนยันผลบันทึกไม่ได้ กรุณาโหลดข้อมูลล่าสุด" },
      { status: 503 },
    );
  await revalidateAdvertisementsCache();
  const warnings = await cleanupAdvertisementAssets(
    supabase,
    readRemovedPaths(result.data, draft.id),
  );
  return Response.json({
    id: result.data.id,
    updatedAt: result.data.updatedAt,
    images,
    warnings,
  });
}
function readRemovedPaths(value: unknown, adId: string): string[] {
  return isRecord(value) && Array.isArray(value.removedPaths)
    ? value.removedPaths.filter((path): path is string =>
        isAdvertisementStoragePath(path, adId),
      )
    : [];
}
export async function deleteAdminAdvertisement(
  request: Request,
  supabase: HomeConfigSupabaseClient,
) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return invalid(["ข้อมูลการลบไม่ถูกต้อง"]);
  }
  if (
    !isRecord(payload) ||
    !isAdvertisementId(payload.id) ||
    typeof payload.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(payload.updatedAt))
  )
    return invalid(["รหัสหรือเวอร์ชันโฆษณาไม่ถูกต้อง"]);
  const { data, error } = await supabase.rpc("delete_site_advertisement", {
    p_id: payload.id,
    p_updated_at: payload.updatedAt,
  });
  if (error) return mutationError(error);
  await revalidateAdvertisementsCache();
  const warnings = await cleanupAdvertisementAssets(
    supabase,
    readRemovedPaths(data, payload.id),
  );
  return Response.json({ deleted: true, warnings });
}
