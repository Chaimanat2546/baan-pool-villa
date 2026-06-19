import { buildAdminLoginTurnstileResponse } from "@/lib/admin/turnstile";

export async function POST(request: Request) {
  return buildAdminLoginTurnstileResponse(request);
}
