import { postPublicVillaReviewVerification } from "@/lib/villa-reviews/route";

export async function POST(
  request: Request,
  context: RouteContext<"/api/villas/[id]/reviews/verification">,
) {
  const { id } = await context.params;
  return postPublicVillaReviewVerification(request, id);
}
