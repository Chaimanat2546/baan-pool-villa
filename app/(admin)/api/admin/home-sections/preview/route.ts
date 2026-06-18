import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { buildHomeSectionsPreviewResponse } from "@/lib/home-sections/admin-preview-route";

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildHomeSectionsPreviewResponse(request);
}
