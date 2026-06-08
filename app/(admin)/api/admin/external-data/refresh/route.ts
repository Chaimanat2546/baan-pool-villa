import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import {
  type ExternalVillaCacheRefreshScope,
  revalidateExternalVillaCache,
} from "@/lib/cache-revalidation";

const REFRESH_CONFIRMATION_HEADER = "x-admin-refresh-confirmation";
const REFRESH_CONFIRMATION_VALUE = "external-villa-cache";
const REFRESH_SCOPE_HEADER = "x-admin-refresh-scope";
const DEFAULT_REFRESH_SCOPE: ExternalVillaCacheRefreshScope = "tags-only";
const REFRESH_COOLDOWN_MS = 60_000;

let lastRefreshRequestedAt = 0;

function readRefreshScope(
  request: Request,
): ExternalVillaCacheRefreshScope | null {
  const requestedScope =
    request.headers.get(REFRESH_SCOPE_HEADER) ?? DEFAULT_REFRESH_SCOPE;

  if (requestedScope === "tags-only" || requestedScope === "full-public") {
    return requestedScope;
  }

  return null;
}

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  if (
    request.headers.get(REFRESH_CONFIRMATION_HEADER) !==
    REFRESH_CONFIRMATION_VALUE
  ) {
    return Response.json(
      { error: "External villa cache refresh requires confirmation." },
      { status: 400 },
    );
  }

  const scope = readRefreshScope(request);

  if (!scope) {
    return Response.json(
      { error: "Unsupported external villa cache refresh scope." },
      { status: 400 },
    );
  }

  const now = Date.now();
  const elapsedMs = now - lastRefreshRequestedAt;

  if (elapsedMs >= 0 && elapsedMs < REFRESH_COOLDOWN_MS) {
    return Response.json(
      {
        error: "External villa cache refresh was requested recently.",
        retryAfterSeconds: Math.ceil((REFRESH_COOLDOWN_MS - elapsedMs) / 1000),
      },
      { status: 429 },
    );
  }

  lastRefreshRequestedAt = now;
  revalidateExternalVillaCache(scope);

  return Response.json({
    refreshed: true,
    scope,
    message: "External villa data cache refresh requested.",
  });
}
