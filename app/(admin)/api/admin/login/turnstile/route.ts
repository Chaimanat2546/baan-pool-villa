import { isAllowedAdminRequestOrigin } from "@/lib/admin/request-origin";
import { verifyTurnstileToken } from "@/lib/admin/turnstile";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

interface TurnstileRequestBody {
  token?: unknown;
}

async function readTurnstileToken(request: Request): Promise<string> {
  try {
    const body = (await request.json()) as TurnstileRequestBody;

    return typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return "";
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    headers: NO_STORE_HEADERS,
    status,
  });
}

export async function POST(request: Request) {
  if (!isAllowedAdminRequestOrigin(request)) {
    return jsonResponse({ error: "Admin request origin is not allowed." }, 403);
  }

  const token = await readTurnstileToken(request);
  const result = await verifyTurnstileToken({ request, token });

  if (!result.ok) {
    return jsonResponse({ error: result.message }, result.status);
  }

  return jsonResponse({
    bypassed: result.bypassed,
    verified: true,
  });
}
