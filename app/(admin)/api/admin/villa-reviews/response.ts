import { AdminVillaReviewError } from "@/lib/villa-reviews/admin";

export function reviewJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function reviewErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AdminVillaReviewError) {
    return reviewJson({
      error: error.message, message: error.message, code: error.code,
      fieldErrors: error.fieldErrors, supabaseCode: error.supabaseCode,
      details: error.details, hint: error.hint,
    }, error.status);
  }
  return reviewJson({ error: fallback, code: "internal_error" }, 500);
}
