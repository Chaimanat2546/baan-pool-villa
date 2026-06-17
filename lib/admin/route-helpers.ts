import "server-only";

import {
  assertHomeConfigAdmin,
  getBearerToken,
  jsonError,
} from "@/lib/admin/home-config-auth";
import { isAllowedAdminRequestOrigin } from "@/lib/admin/request-origin";

type AdminCheck = Awaited<ReturnType<typeof assertHomeConfigAdmin>>;
export type HomeConfigSupabaseClient = Extract<AdminCheck, { ok: true }>["supabase"];

export interface SupabaseLikeError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number | string;
  statusCode?: number | string;
}

export type AdminRouteAuthResult =
  | {
      ok: true;
      supabase: HomeConfigSupabaseClient;
    }
  | {
      ok: false;
      response: Response;
    };

/**
 * Applies shared origin and bearer-token admin checks before a route uses the
 * home-config Supabase client.
 *
 * @param request - The incoming admin request to authorize.
 * @returns Either an authorized Supabase client or an error response ready to
 * return from the route.
 */
export async function requireHomeConfigAdmin(
  request: Request,
): Promise<AdminRouteAuthResult> {
  if (!isAllowedAdminRequestOrigin(request)) {
    return {
      ok: false,
      response: jsonError("Admin request origin is not allowed.", 403),
    };
  }

  const token = getBearerToken(request);

  if (!token) {
    return { ok: false, response: jsonError("Missing bearer token.", 401) };
  }

  const adminCheck = await assertHomeConfigAdmin(token);

  if (!adminCheck.ok) {
    return {
      ok: false,
      response: jsonError(adminCheck.message, adminCheck.status),
    };
  }

  return { ok: true, supabase: adminCheck.supabase };
}

function isNoRowsError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();

  return (
    error.code === "PGRST116" ||
    message.includes("contains 0 rows") ||
    message.includes("result contains 0 rows")
  );
}

/**
 * Maps Supabase-like errors to the HTTP status code used by admin API routes.
 *
 * @param error - The Supabase-like error object to inspect.
 * @returns The HTTP status code that best represents the error.
 */
export function getSupabaseErrorStatus(
  error: SupabaseLikeError | null | undefined,
): number {
  const explicitStatus = error?.status ?? error?.statusCode;
  const status =
    typeof explicitStatus === "string" ? Number(explicitStatus) : explicitStatus;

  if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) {
    return status;
  }

  if (error?.code === "42501") {
    return 403;
  }

  if (error?.code === "PGRST301") {
    return 401;
  }

  if (isNoRowsError(error)) {
    return 404;
  }

  return 500;
}

/**
 * Builds a shared JSON error response from a Supabase-like error object.
 *
 * @param error - The Supabase-like error object returned by a request.
 * @param fallbackMessage - The fallback message to use when the error has no message.
 * @param extra - Optional extra fields to include in the JSON response.
 * @returns A JSON error response with normalized status and Supabase details.
 */
export function adminSupabaseErrorResponse(
  error: SupabaseLikeError | null | undefined,
  fallbackMessage: string,
  extra?: Record<string, string | null | undefined>,
) {
  return jsonError(error?.message ?? fallbackMessage, getSupabaseErrorStatus(error), {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    ...extra,
  });
}
