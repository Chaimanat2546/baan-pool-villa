export const MAX_AGENT_OPERATION_BODY_BYTES = 16_384;

export type BoundedRequestBytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "too_large" | "invalid_body" };

function precheckedContentLength(request: Request): number | null {
  const value = request.headers.get("Content-Length");
  if (!value || !/^(?:0|[1-9]\d*)$/.test(value)) {
    return null;
  }

  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
}

/** Reads a request body without trusting its declared Content-Length. */
export async function readBoundedRequestBytes(
  request: Request,
  maximumBytes = MAX_AGENT_OPERATION_BODY_BYTES,
): Promise<BoundedRequestBytesResult> {
  const contentLength = precheckedContentLength(request);
  if (contentLength !== null && contentLength > maximumBytes) {
    return { ok: false, reason: "too_large" };
  }

  let body: ReadableStream<Uint8Array> | null;
  try {
    body = request.body;
  } catch {
    return { ok: false, reason: "invalid_body" };
  }
  if (!body) {
    return { ok: true, bytes: new Uint8Array() };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = body.getReader();
  } catch {
    return { ok: false, reason: "invalid_body" };
  }

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      if (!(chunk.value instanceof Uint8Array)) {
        return { ok: false, reason: "invalid_body" };
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The request is already rejected; cancellation is best effort.
        }
        return { ok: false, reason: "too_large" };
      }
      chunks.push(chunk.value);
    }
  } catch {
    return { ok: false, reason: "invalid_body" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes };
}

export async function sha256Hex(
  bytes: Uint8Array,
  cryptoDependency: Pick<Crypto, "subtle"> = globalThis.crypto,
): Promise<string> {
  const ownedBytes = new Uint8Array(bytes.byteLength);
  ownedBytes.set(bytes);
  const digest = await cryptoDependency.subtle.digest(
    "SHA-256",
    ownedBytes.buffer,
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
