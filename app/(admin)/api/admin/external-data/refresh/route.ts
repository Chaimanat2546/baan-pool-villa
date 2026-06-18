import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { revalidateExternalVillaCache } from "@/lib/cache-revalidation";
import {
  buildExternalVillaRefreshResponse,
  markExternalVillaRefreshRequested,
  validateExternalVillaRefreshRequest,
} from "@/lib/villas/admin-refresh-route";

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const validation = validateExternalVillaRefreshRequest(request);

  if (!validation.ok) {
    return validation.response;
  }

  await revalidateExternalVillaCache();
  markExternalVillaRefreshRequested();

  return buildExternalVillaRefreshResponse(validation.scope);
}
