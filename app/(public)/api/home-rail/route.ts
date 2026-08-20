import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { CACHE_HEADERS } from "@/lib/cache-policy";
import { normalizeHouseId } from "@/lib/home-sections/validation";
import { getCriticalHomeRailBatch } from "../../(home)/server-data";

const RAIL_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_RAIL_KEY_LENGTH = 128;
const ALLOWED_OFFSETS = new Set([4, 8]);

function readContinuationRequest(request: Request):
  | { excludedVillaIds: string[]; offset: number; railKey: string; response: null }
  | { excludedVillaIds: null; offset: null; railKey: null; response: Response } {
  const searchParams = new URL(request.url).searchParams;
  const entries = [...searchParams.entries()];
  const railKeys = searchParams.getAll("rail");
  const offsets = searchParams.getAll("offset");
  const excludedVillaIds = searchParams.getAll("exclude");
  const railKey = railKeys[0] ?? "";
  const offset = Number(offsets[0]);

  if (
    entries.length !== 2 + excludedVillaIds.length ||
    railKeys.length !== 1 ||
    offsets.length !== 1 ||
    railKey.length > MAX_RAIL_KEY_LENGTH ||
    !RAIL_KEY_PATTERN.test(railKey) ||
    !ALLOWED_OFFSETS.has(offset) ||
    offsets[0] !== String(offset) ||
    excludedVillaIds.length > offset ||
    new Set(excludedVillaIds).size !== excludedVillaIds.length ||
    excludedVillaIds.some((id) => normalizeHouseId(id) !== id)
  ) {
    return {
      excludedVillaIds: null,
      offset: null,
      railKey: null,
      response: Response.json(
        { error: "Invalid home rail request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return { excludedVillaIds, offset, railKey, response: null };
}

export async function GET(request: Request) {
  const parsedRequest = readContinuationRequest(request);

  if (parsedRequest.response) {
    return parsedRequest.response;
  }

  const rateLimitResponse = limitPublicApiRequest(request, "publicCatalog");

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return Response.json(
    await getCriticalHomeRailBatch(
      parsedRequest.railKey,
      parsedRequest.offset,
      parsedRequest.excludedVillaIds,
    ),
    { headers: { "Cache-Control": CACHE_HEADERS.homeSections } },
  );
}
