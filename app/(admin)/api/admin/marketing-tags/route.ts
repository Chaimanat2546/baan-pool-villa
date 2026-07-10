import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminMarketingTagsResponse,
  saveAdminMarketingTags,
} from "@/lib/site-settings/marketing-tags-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminMarketingTagsResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminMarketingTags(request, admin.supabase);
}
