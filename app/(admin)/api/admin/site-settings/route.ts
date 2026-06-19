import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminSiteSettingsResponse,
  saveAdminSiteSettings,
} from "@/lib/site-settings/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminSiteSettingsResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminSiteSettings(request, admin.supabase);
}
