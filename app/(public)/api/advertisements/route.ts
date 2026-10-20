import { getActiveAdvertisements } from "@/lib/advertisements/server";
import { ADVERTISEMENT_ZONES, parseAdvertisementCursor } from "@/lib/advertisements/validation";
import { limitPublicApiRequest } from "@/lib/api/rate-limit";
import { CACHE_HEADERS } from "@/lib/cache-policy";

export async function GET(request: Request) {
  const limited = limitPublicApiRequest(request, "publicCatalog");
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const zone = params.get("zone") ?? "";
  const after = params.get("after") ?? undefined;
  if ((zone && !ADVERTISEMENT_ZONES.some(item => item.value === zone)) || (after !== undefined && !parseAdvertisementCursor(after))) {
    return Response.json({ error: "ข้อมูลการโหลดโฆษณาไม่ถูกต้อง" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return Response.json(await getActiveAdvertisements(zone || undefined, after), { headers: { "Cache-Control": CACHE_HEADERS.advertisements } });
  } catch {
    return Response.json({ error: "โหลดโฆษณาเพิ่มเติมไม่สำเร็จ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
