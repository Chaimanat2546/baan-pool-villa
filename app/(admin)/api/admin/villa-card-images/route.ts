import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  buildAdminVillaCardImageConfigsResponse,
  deleteAdminVillaCardCoverImage,
  saveAdminVillaCardImages,
} from "@/lib/villas/card-image-config-admin";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminVillaCardImageConfigsResponse(admin.supabase, request);
}

export async function PUT(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return saveAdminVillaCardImages(request, admin.supabase);
}

export async function DELETE(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return deleteAdminVillaCardCoverImage(request, admin.supabase);
}
