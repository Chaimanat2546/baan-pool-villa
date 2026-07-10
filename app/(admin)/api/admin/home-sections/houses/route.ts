import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { normalizeHouseId } from "@/lib/home-sections/validation";
import {
  fetchHouseListings,
  fetchVillaCardHouseOptionPage,
} from "@/lib/villas/server";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const url = new URL(request.url);
  const ids = [...new Set(
    (url.searchParams.get("ids") ?? "")
      .split(",")
      .map(normalizeHouseId)
      .filter((id): id is string => Boolean(id)),
  )];

  if (ids.length > 0) {
    const housesById = new Map(
      (await fetchHouseListings()).map((house) => [house.id, house]),
    );

    return Response.json({
      houses: ids.flatMap((id) => {
        const house = housesById.get(id);

        return house ? [{ id, title: house.title ?? `บ้าน ${id}` }] : [];
      }),
    });
  }

  const result = await fetchVillaCardHouseOptionPage({
    page: 1,
    pageSize: 10,
    search: url.searchParams.get("search")?.trim() ?? "",
  });

  return Response.json({
    houses: result.items.map(({ id, title }) => ({ id, title })),
  });
}
