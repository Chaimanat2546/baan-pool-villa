import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { searchTikTokVillaOptions } from "@/lib/tiktok/villa-links";
import { fetchHouseListings } from "@/lib/villas/server";

const TIKTOK_VILLA_QUERY_MAX_LENGTH = 80;

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);

  if (!admin.ok) {
    return admin.response;
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";

  if (query.length > TIKTOK_VILLA_QUERY_MAX_LENGTH) {
    return Response.json(
      { error: "ข้อความค้นหาบ้านพัก TikTok ต้องมีความยาวไม่เกิน 80 ตัวอักษร" },
      { status: 400 },
    );
  }

  let villas;

  try {
    villas = await fetchHouseListings();
  } catch {
    return Response.json(
      { error: "ไม่สามารถโหลดรายการบ้านพักได้ในขณะนี้" },
      { status: 500 },
    );
  }

  return Response.json({
    villas: searchTikTokVillaOptions(villas, query),
  });
}
