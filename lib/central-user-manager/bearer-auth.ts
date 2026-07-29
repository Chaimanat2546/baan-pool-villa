import "server-only";

import { SAFE_AGENT_ERROR_CATALOG } from "./safe-errors";

const BASE64URL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CANONICAL_BASE64URL_FINAL_CHARACTER_PATTERN = /^[AEIMQUYcgkosw048]$/;
const SHA_256_DIGEST_BYTES = 32;
const PRIVATE_NO_STORE_NOSNIFF_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export interface VerifiedCentralBearerRequest {
  tokenVersion: number;
}

type WebCryptoDependency = Pick<Crypto, "subtle">;

function isValidToken(value: string): boolean {
  return (
    BASE64URL_TOKEN_PATTERN.test(value) &&
    CANONICAL_BASE64URL_FINAL_CHARACTER_PATTERN.test(value.charAt(42))
  );
}

function errorResponse(status: 401 | 503): Response {
  const error =
    status === 401
      ? SAFE_AGENT_ERROR_CATALOG.invalid_request
      : SAFE_AGENT_ERROR_CATALOG.provider_failure;

  return Response.json(
    { error: error.message },
    {
      status,
      headers:
        status === 401
          ? {
              ...PRIVATE_NO_STORE_NOSNIFF_HEADERS,
              "WWW-Authenticate": "Bearer",
            }
          : PRIVATE_NO_STORE_NOSNIFF_HEADERS,
    },
  );
}

async function hashToken(value: string, cryptoDependency: WebCryptoDependency) {
  return new Uint8Array(
    await cryptoDependency.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    ),
  );
}

function equalSha256Digests(left: Uint8Array, right: Uint8Array): boolean {
  let difference =
    (left.length ^ SHA_256_DIGEST_BYTES) |
    (right.length ^ SHA_256_DIGEST_BYTES);

  for (let index = 0; index < SHA_256_DIGEST_BYTES; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

export async function requireCentralBearer(
  request: Request,
  expectedToken: string,
  tokenVersion: number,
  cryptoDependency: WebCryptoDependency = globalThis.crypto,
): Promise<VerifiedCentralBearerRequest | Response> {
  if (!isValidToken(expectedToken)) {
    return errorResponse(503);
  }

  const authorization = request.headers.get("Authorization");
  const suppliedToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!suppliedToken || !isValidToken(suppliedToken)) {
    return errorResponse(401);
  }

  const [expectedDigest, suppliedDigest] = await Promise.all([
    hashToken(expectedToken, cryptoDependency),
    hashToken(suppliedToken, cryptoDependency),
  ]);

  if (!equalSha256Digests(expectedDigest, suppliedDigest)) {
    return errorResponse(401);
  }

  return { tokenVersion };
}
