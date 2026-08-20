import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { CACHE_HEADERS } from "@/lib/cache-policy";
import { getDeferredHomePayload } from "../../(home)/server-data";

const CRITICAL_RAIL_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CRITICAL_RAIL_KEY_LENGTH = 128;

function readCriticalRailKey(request: Request):
  | { criticalRailKey: string | null; response: null }
  | { criticalRailKey: null; response: Response } {
  const entries = [...new URL(request.url).searchParams.entries()];

  if (entries.length === 0) {
    return { criticalRailKey: null, response: null };
  }

  const [name, value] = entries[0] ?? [];

  if (
    entries.length !== 1 ||
    name !== "criticalRail" ||
    value.length > MAX_CRITICAL_RAIL_KEY_LENGTH ||
    !CRITICAL_RAIL_KEY_PATTERN.test(value)
  ) {
    return {
      criticalRailKey: null,
      response: Response.json(
        { error: "Invalid deferred home request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return { criticalRailKey: value, response: null };
}

export async function GET(request: Request) {
  const parsedRequest = readCriticalRailKey(request);

  if (parsedRequest.response) {
    return parsedRequest.response;
  }

  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return Response.json(
    await getDeferredHomePayload(parsedRequest.criticalRailKey),
    {
    headers: {
      "Cache-Control": CACHE_HEADERS.homeSections,
    },
    },
  );
}
