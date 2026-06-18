import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { buildAdminExternalVillaRefreshResponse } from "@/lib/villas/admin-refresh-route";

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  return buildAdminExternalVillaRefreshResponse(request);
}
