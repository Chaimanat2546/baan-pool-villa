import { getPublicVillaReviews, postPublicVillaReview } from "@/lib/villa-reviews/route";

export async function GET(request: Request, context: RouteContext<"/api/villas/[id]/reviews">) {
  const { id } = await context.params;
  return getPublicVillaReviews(request, id);
}

export async function POST(request: Request, context: RouteContext<"/api/villas/[id]/reviews">) {
  const { id } = await context.params;
  return postPublicVillaReview(request, id);
}
