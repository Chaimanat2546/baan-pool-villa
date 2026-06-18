import { normalizeHouseId } from "@/lib/home-sections/validation";
import { fetchHouseListings } from "@/lib/villas/server";

interface PreviewHouseIds {
  invalidIds: string[];
  requestedIds: string[];
}

function parseHouseIdsPayload(payload: unknown): unknown[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { houseIds?: unknown }).houseIds)
  ) {
    return [];
  }

  return (payload as { houseIds: unknown[] }).houseIds;
}

function formatInvalidHouseId(houseId: unknown): string {
  if (typeof houseId === "string") {
    return houseId;
  }

  const stringifiedHouseId = JSON.stringify(houseId);

  return stringifiedHouseId
    ? `non-string:${stringifiedHouseId}`
    : `non-string:${String(houseId)}`;
}

function parsePreviewHouseIds(payload: unknown): PreviewHouseIds {
  return parseHouseIdsPayload(payload).reduce<PreviewHouseIds>(
    (result, houseId) => {
      if (typeof houseId !== "string") {
        result.invalidIds.push(formatInvalidHouseId(houseId));
        return result;
      }

      const normalizedHouseId = normalizeHouseId(houseId);

      if (!normalizedHouseId) {
        result.invalidIds.push(formatInvalidHouseId(houseId));
        return result;
      }

      if (!result.requestedIds.includes(normalizedHouseId)) {
        result.requestedIds.push(normalizedHouseId);
      }

      return result;
    },
    {
      invalidIds: [],
      requestedIds: [],
    },
  );
}

export async function buildHomeSectionsPreviewResponse(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ errors: ["Request body must be JSON."] }, { status: 400 });
  }

  const { invalidIds, requestedIds } = parsePreviewHouseIds(payload);
  const villas = await fetchHouseListings();
  const villasById = new Map(villas.map((villa) => [villa.id, villa]));
  const validIds = requestedIds.filter((houseId) => villasById.has(houseId));
  const missingIds = requestedIds.filter((houseId) => !villasById.has(houseId));

  return Response.json({ validIds, missingIds, invalidIds });
}
