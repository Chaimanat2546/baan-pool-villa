import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  getAdminSiteHeaderSettings,
  saveAdminSiteHeaderSettings,
} from "@/lib/site-header-settings/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok ? getAdminSiteHeaderSettings(admin.supabase) : admin.response;
}

export async function PATCH(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? saveAdminSiteHeaderSettings(request, admin.supabase)
    : admin.response;
}
