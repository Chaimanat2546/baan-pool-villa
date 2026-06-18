import {
  buildAdminGuidesListResponse,
  deleteAdminGuide,
  saveAdminGuide,
} from "@/lib/guides/admin-route";
import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminGuidesListResponse(admin.supabase);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminGuide(request, admin.supabase);
}

export async function DELETE(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return deleteAdminGuide(request, admin.supabase);
}
