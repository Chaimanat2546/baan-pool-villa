import {
  buildAdminLegalPagesResponse,
  saveAdminLegalPage,
} from "@/lib/legal-pages/admin-route";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminLegalPagesResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminLegalPage(request, admin.supabase);
}
