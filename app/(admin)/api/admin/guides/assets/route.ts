import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { uploadAdminGuideAsset } from "@/lib/guides/admin-assets-route";

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return uploadAdminGuideAsset(request, admin.supabase);
}
