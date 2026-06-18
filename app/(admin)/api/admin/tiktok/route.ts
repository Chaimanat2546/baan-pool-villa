import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminTikTokSettingsResponse,
  saveAdminTikTokSettings,
} from "@/lib/site-settings/admin-tiktok-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminTikTokSettingsResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminTikTokSettings(request, admin.supabase);
}
