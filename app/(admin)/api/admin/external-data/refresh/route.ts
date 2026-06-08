import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { revalidateExternalVillaCache } from "@/lib/cache-revalidation";

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  revalidateExternalVillaCache();

  return Response.json({
    refreshed: true,
    message: "External villa data cache refresh requested.",
  });
}
