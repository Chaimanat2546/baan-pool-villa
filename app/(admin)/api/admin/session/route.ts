import { getBearerToken } from "@/lib/admin/home-config-auth";
import { inspectForcedPasswordSession } from "@/lib/admin/forced-password-change";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
} as const;

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return Response.json(
      { state: "invalid", code: "session_invalid" },
      { headers: PRIVATE_HEADERS, status: 401 },
    );
  }

  const session = await inspectForcedPasswordSession(token);
  if (!("code" in session)) {
    return Response.json({ state: session.state }, { headers: PRIVATE_HEADERS });
  }
  return Response.json(
    { state: session.state, code: session.code },
    { headers: PRIVATE_HEADERS, status: session.status },
  );
}
