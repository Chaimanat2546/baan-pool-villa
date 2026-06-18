import { revalidateExternalVillaCache } from "@/lib/cache-revalidation";

const REFRESH_CONFIRMATION_HEADER = "x-admin-refresh-confirmation";
const REFRESH_CONFIRMATION_VALUE = "external-villa-cache";
const REFRESH_SCOPE_HEADER = "x-admin-refresh-scope";
const DEFAULT_REFRESH_SCOPE = "tags-only";
const REFRESH_COOLDOWN_MS = 60_000;
const REFRESH_COOLDOWN_SECONDS = Math.ceil(REFRESH_COOLDOWN_MS / 1000);

let lastRefreshRequestedAt = 0;

function readRefreshScope(request: Request): typeof DEFAULT_REFRESH_SCOPE | null {
  const requestedScope =
    request.headers.get(REFRESH_SCOPE_HEADER) ?? DEFAULT_REFRESH_SCOPE;

  if (requestedScope === DEFAULT_REFRESH_SCOPE) {
    return DEFAULT_REFRESH_SCOPE;
  }

  return null;
}

export function validateExternalVillaRefreshRequest(request: Request):
  | {
      ok: true;
      scope: typeof DEFAULT_REFRESH_SCOPE;
    }
  | {
      ok: false;
      response: Response;
    } {
  if (
    request.headers.get(REFRESH_CONFIRMATION_HEADER) !==
    REFRESH_CONFIRMATION_VALUE
  ) {
    return {
      ok: false,
      response: Response.json(
        { error: "External villa cache refresh requires confirmation." },
        { status: 400 },
      ),
    };
  }

  const scope = readRefreshScope(request);

  if (!scope) {
    return {
      ok: false,
      response: Response.json(
        { error: "Unsupported external villa cache refresh scope." },
        { status: 400 },
      ),
    };
  }

  const now = Date.now();
  const elapsedMs = now - lastRefreshRequestedAt;

  if (elapsedMs >= 0 && elapsedMs < REFRESH_COOLDOWN_MS) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "External villa cache refresh was requested recently.",
          retryAfterSeconds: Math.ceil((REFRESH_COOLDOWN_MS - elapsedMs) / 1000),
        },
        { status: 429 },
      ),
    };
  }

  return { ok: true, scope };
}

export function markExternalVillaRefreshRequested() {
  lastRefreshRequestedAt = Date.now();
}

export function buildExternalVillaRefreshResponse(scope: typeof DEFAULT_REFRESH_SCOPE) {
  return Response.json({
    refreshed: true,
    scope,
    retryAfterSeconds: REFRESH_COOLDOWN_SECONDS,
    message: "External villa data cache refresh requested.",
  });
}

export async function buildAdminExternalVillaRefreshResponse(request: Request) {
  const validation = validateExternalVillaRefreshRequest(request);

  if (!validation.ok) {
    return validation.response;
  }

  await revalidateExternalVillaCache();
  markExternalVillaRefreshRequested();

  return buildExternalVillaRefreshResponse(validation.scope);
}
