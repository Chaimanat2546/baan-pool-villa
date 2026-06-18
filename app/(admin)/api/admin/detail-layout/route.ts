import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminDetailLayoutResponse,
  saveAdminDetailLayout,
} from "@/lib/detail-layout/admin-route";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminDetailLayoutResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminDetailLayout(request, admin.supabase);
}
