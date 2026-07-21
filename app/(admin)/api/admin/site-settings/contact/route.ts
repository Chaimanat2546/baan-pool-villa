import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  getAdminSiteContactSettings,
  saveAdminSiteContactSettings,
} from "@/lib/site-contact-settings/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? getAdminSiteContactSettings(admin.supabase)
    : admin.response;
}

export async function PATCH(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? saveAdminSiteContactSettings(request, admin.supabase)
    : admin.response;
}
