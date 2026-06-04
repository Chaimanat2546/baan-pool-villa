import { assertHomeConfigAdmin, getBearerToken, jsonError } from "@/lib/admin/home-config-auth";
import { revalidateExternalVillaCache } from "@/lib/cache-revalidation";

export async function POST(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return jsonError("Missing bearer token.", 401);
  }

  const adminCheck = await assertHomeConfigAdmin(token);

  if (!adminCheck.ok) {
    return jsonError(adminCheck.message, adminCheck.status);
  }

  revalidateExternalVillaCache();

  return Response.json({
    refreshed: true,
    message: "External villa data cache refresh requested.",
  });
}
