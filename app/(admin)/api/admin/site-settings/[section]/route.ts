import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminSiteSettingsSectionResponse,
  saveAdminSiteSettingsSection,
} from "@/lib/site-settings/admin-section-route";
import { isSiteSettingsSection } from "@/lib/site-settings/admin-section-contracts";

type Context = { params: Promise<{ section: string }> };

async function readSection(context: Context) {
  const { section } = await context.params;
  return isSiteSettingsSection(section) ? section : null;
}

export async function GET(request: Request, context: Context) {
  const section = await readSection(context);
  if (!section) {
    return Response.json({ error: "Unknown settings section." }, { status: 404 });
  }
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? buildAdminSiteSettingsSectionResponse(section, admin.supabase)
    : admin.response;
}

export async function PATCH(request: Request, context: Context) {
  const section = await readSection(context);
  if (!section) {
    return Response.json({ error: "Unknown settings section." }, { status: 404 });
  }
  const admin = await requireHomeConfigAdmin(request);
  return admin.ok
    ? saveAdminSiteSettingsSection(request, section, admin.supabase)
    : admin.response;
}
