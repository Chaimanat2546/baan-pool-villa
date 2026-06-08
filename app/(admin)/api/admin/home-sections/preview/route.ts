import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { normalizeHouseId } from "@/lib/home-sections/validation";
import { fetchHouseListings } from "@/lib/villas/server";

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

export async function POST(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const { requestedIds, invalidIds } = parseHouseIdsPayload(payload).reduce<{
    requestedIds: string[];
    invalidIds: string[];
  }>(
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
      requestedIds: [],
      invalidIds: [],
    },
  );
  const villas = await fetchHouseListings();
  const villasById = new Map(villas.map((villa) => [villa.id, villa]));
  const valid = requestedIds.flatMap((houseId) => {
    const villa = villasById.get(houseId);

    return villa ? [villa] : [];
  });
  const missingIds = requestedIds.filter((houseId) => !villasById.has(houseId));

  return Response.json({ valid, missingIds, invalidIds });
}
