import "server-only";
import {
  adminSupabaseErrorResponse,
  type HomeConfigSupabaseClient,
} from "@/lib/admin/route-helpers";
import { convertImageToWebp } from "@/lib/image-conversion";
import { ADVERTISEMENT_BUCKET } from "./types";
import { isAdvertisementStoragePath } from "./validation";

export interface UploadedAdvertisementAsset {
  id: string;
  storagePath: string;
}

export async function cleanupAdvertisementAssets(
  supabase: HomeConfigSupabaseClient,
  paths: string[],
): Promise<string[]> {
  const warnings: string[] = [];
  for (const path of paths) {
    if (!isAdvertisementStoragePath(path)) {
      warnings.push("ข้ามการลบไฟล์ที่มีเส้นทางไม่ถูกต้อง");
      continue;
    }
    const { error } = await supabase.storage
      .from(ADVERTISEMENT_BUCKET)
      .remove([path]);
    if (error) {
      warnings.push("บันทึกแล้ว แต่ลบไฟล์ที่ไม่ได้ใช้บางไฟล์ไม่สำเร็จ");
      continue;
    }
    const history = await supabase
      .from("site_advertisement_uploads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("storage_path", path);
    if (history.error)
      warnings.push("ลบไฟล์แล้ว แต่ปรับประวัติอัปโหลดไม่สำเร็จ");
  }
  return [...new Set(warnings)];
}

export async function uploadAdvertisementAssets(
  supabase: HomeConfigSupabaseClient,
  adId: string,
  files: File[],
): Promise<{
  assets: UploadedAdvertisementAsset[];
  response: Response | null;
}> {
  const assets: UploadedAdvertisementAsset[] = [];
  const uploadedPaths: string[] = [];
  try {
    for (const file of files) {
      const converted = await convertImageToWebp(file);
      if (converted.size > 6 * 1024 * 1024)
        throw new Error("รูปที่แปลงแล้วมีขนาดเกิน 6 MB");
      const id = crypto.randomUUID();
      const storagePath = `${adId}/${id}.webp`;
      const upload = await supabase.storage
        .from(ADVERTISEMENT_BUCKET)
        .upload(storagePath, converted, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });
      if (upload.error) {
        await cleanupAdvertisementAssets(supabase, uploadedPaths);
        return {
          assets: [],
          response: adminSupabaseErrorResponse(
            upload.error,
            "อัปโหลดรูปโฆษณาไม่สำเร็จ",
          ),
        };
      }
      uploadedPaths.push(storagePath);
      const history = await supabase
        .from("site_advertisement_uploads")
        .insert({ id, storage_path: storagePath });
      if (history.error) {
        await cleanupAdvertisementAssets(supabase, uploadedPaths);
        return {
          assets: [],
          response: adminSupabaseErrorResponse(
            history.error,
            "บันทึกประวัติอัปโหลดไม่สำเร็จ",
          ),
        };
      }
      assets.push({ id, storagePath });
    }
    return { assets, response: null };
  } catch {
    await cleanupAdvertisementAssets(supabase, uploadedPaths);
    return {
      assets: [],
      response: Response.json(
        {
          errors: [
            "อ่านหรือแปลงรูปไม่สำเร็จ กรุณาใช้ไฟล์ JPG, PNG หรือ WebP ที่เปิดดูได้",
          ],
        },
        { status: 400 },
      ),
    };
  }
}
