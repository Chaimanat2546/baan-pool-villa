import "server-only";

const MINIMUM_TOKEN_LENGTH = 32;
const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function errorResponse(message: string, status: 401 | 503) {
  return Response.json(
    { error: message },
    {
      status,
      headers:
        status === 401
          ? {
              ...PRIVATE_NO_STORE_HEADERS,
              "WWW-Authenticate": "Bearer",
            }
          : PRIVATE_NO_STORE_HEADERS,
    },
  );
}

function readBearerCredential(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer ([^\s,]+)$/);

  return match?.[1] ?? null;
}

async function hashCredential(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function equalWithoutEarlyExit(left: Uint8Array, right: Uint8Array) {
  let difference = left.length ^ right.length;
  const comparedLength = Math.max(left.length, right.length);

  for (let index = 0; index < comparedLength; index += 1) {
    difference |=
      (left[index % left.length] ?? 0) ^ (right[index % right.length] ?? 0);
  }

  return difference === 0;
}

export async function requireCalendarInternalBearer(
  request: Request,
): Promise<Response | null> {
  const expected = process.env.CALENDAR_INTERNAL_API_TOKEN;

  if (!expected || expected.length < MINIMUM_TOKEN_LENGTH) {
    return errorResponse("Calendar API is not configured.", 503);
  }

  const supplied = readBearerCredential(request);

  if (!supplied) {
    return errorResponse("Unauthorized.", 401);
  }

  const [expectedHash, suppliedHash] = await Promise.all([
    hashCredential(expected),
    hashCredential(supplied),
  ]);

  if (!equalWithoutEarlyExit(expectedHash, suppliedHash)) {
    return errorResponse("Unauthorized.", 401);
  }

  return null;
}
