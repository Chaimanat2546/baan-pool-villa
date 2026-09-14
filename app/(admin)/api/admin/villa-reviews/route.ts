import { requireHomeConfigAdmin } from "@/lib/admin/route-helpers";
import { AdminVillaReviewError, listAdminVillaReviews, parseAdminReviewListQuery } from "@/lib/villa-reviews/admin";
import type { AdminVillaReviewListQuery } from "@/lib/villa-reviews/types";
import { reviewErrorResponse, reviewJson } from "./response";

export async function GET(request: Request) {
  const admin = await requireHomeConfigAdmin(request);
  if (!admin.ok) return admin.response;
  try {
    const params = new URL(request.url).searchParams;
    const search = params.get("q");
    const rating = params.get("rating");
    const page = params.get("page");
    const pageSize = params.get("pageSize");
    const villaId = params.get("villaId");
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const sort = params.get("sort");
    const hasImages = params.get("hasImages");
    if ([...params.keys()].some((key) => !["q", "rating", "page", "pageSize", "villaId", "dateFrom", "dateTo", "sort", "hasImages"].includes(key) || params.getAll(key).length !== 1)
      || (search !== null && (search.length > 100 || /[\u0000-\u001f\u007f]/.test(search)))
      || (rating !== null && !/^[1-5]$/.test(rating))
      || (page !== null && !/^[1-9]\d{0,14}$/.test(page))
      || (pageSize !== null && !/^[1-9]\d?$/.test(pageSize))
      || (hasImages !== null && hasImages !== "true" && hasImages !== "false")) {
      throw new AdminVillaReviewError("validation_error", "ตัวกรองรีวิวไม่ถูกต้อง", 400);
    }
    const query: AdminVillaReviewListQuery = {
      ...(search !== null ? { search: search.trim() } : {}),
      ...(rating !== null ? { rating: Number(rating) } : {}),
      ...(page !== null ? { page: Number(page) } : {}),
      ...(pageSize !== null ? { pageSize: Number(pageSize) } : {}),
      ...(villaId !== null ? { villaId } : {}),
      ...(dateFrom !== null ? { dateFrom } : {}),
      ...(dateTo !== null ? { dateTo } : {}),
      ...(sort !== null ? { sort: sort as AdminVillaReviewListQuery["sort"] } : {}),
      ...(hasImages !== null ? { hasImages: hasImages === "true" } : {}),
    };
    parseAdminReviewListQuery(query);
    return reviewJson(await listAdminVillaReviews(query));
  } catch (error) {
    return reviewErrorResponse(error, "ไม่สามารถโหลดรีวิวได้");
  }
}
