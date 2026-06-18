import {
  buildAdminHomeSectionsResponse,
  saveAdminHomeSections,
} from "@/lib/home-sections/admin-route";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminHomeSectionsResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminHomeSections(request, admin.supabase);
}
