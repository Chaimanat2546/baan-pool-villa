import {
  changeForcedPassword,
  createForcedPasswordChangeDependencies,
} from "@/lib/admin/forced-password-change";
import { getBearerToken } from "@/lib/admin/home-config-auth";
import { isAllowedAdminRequestOrigin } from "@/lib/admin/request-origin";
import { isCanonicalRfc9562Uuid } from "@/lib/central-user-manager/canonical-uuid";
import { readBoundedRequestBytes } from "@/lib/central-user-manager/route-response";

const MAX_BODY_BYTES = 2_048;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
} as const;
const BODY_KEYS = [
  "operationId",
  "currentPassword",
  "newPassword",
  "confirmPassword",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validBody(value: unknown): value is {
  operationId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
} {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return (
    keys.length === BODY_KEYS.length &&
    keys.every((key) => (BODY_KEYS as readonly string[]).includes(key)) &&
    isCanonicalRfc9562Uuid(value.operationId) &&
    typeof value.currentPassword === "string" &&
    value.currentPassword.length > 0 &&
    value.currentPassword.length <= 128 &&
    typeof value.newPassword === "string" &&
    value.newPassword.length > 0 &&
    value.newPassword.length <= 128 &&
    typeof value.confirmPassword === "string" &&
    value.confirmPassword.length > 0 &&
    value.confirmPassword.length <= 128
  );
}

function failureStatus(code: string): number {
  if (code === "temporary_password_invalid") {
    return 401;
  }
  if (
    code === "lease_conflict" ||
    code === "operation_conflict" ||
    code === "late_fence"
  ) {
    return 409;
  }
  if (
    code === "provider_ambiguous" ||
    code === "quarantine_failed" ||
    code === "database_unavailable" ||
    code === "verification_failed"
  ) {
    return 503;
  }
  if (
    code === "invalid" ||
    code === "session_invalid" ||
    code === "version_mismatch" ||
    code === "inactive"
  ) {
    return 403;
  }
  return 400;
}

export async function POST(request: Request) {
  if (!isAllowedAdminRequestOrigin(request)) {
    return Response.json(
      { code: "origin_not_allowed" },
      { headers: PRIVATE_HEADERS, status: 403 },
    );
  }
  if (request.headers.get("content-type") !== "application/json") {
    return Response.json(
      { code: "invalid_content_type" },
      { headers: PRIVATE_HEADERS, status: 415 },
    );
  }
  const token = getBearerToken(request);
  if (!token) {
    return Response.json(
      { code: "session_invalid" },
      { headers: PRIVATE_HEADERS, status: 401 },
    );
  }

  const bounded = await readBoundedRequestBytes(request, MAX_BODY_BYTES);
  if (!bounded.ok) {
    return Response.json(
      { code: bounded.reason === "too_large" ? "body_too_large" : "invalid_body" },
      {
        headers: PRIVATE_HEADERS,
        status: bounded.reason === "too_large" ? 413 : 400,
      },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bounded.bytes),
    );
  } catch {
    return Response.json(
      { code: "invalid_body" },
      { headers: PRIVATE_HEADERS, status: 400 },
    );
  }
  if (!validBody(rawBody)) {
    return Response.json(
      { code: "invalid_body" },
      { headers: PRIVATE_HEADERS, status: 400 },
    );
  }

  try {
    const result = await changeForcedPassword(
      { ...rawBody, token },
      createForcedPasswordChangeDependencies(),
    );
    return Response.json(result, {
      headers: PRIVATE_HEADERS,
      status: result.ok ? 200 : failureStatus(result.code),
    });
  } catch {
    return Response.json(
      { ok: false, code: "service_unavailable", clearSession: true },
      { headers: PRIVATE_HEADERS, status: 503 },
    );
  }
}
