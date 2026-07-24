const CALENDAR_TOKEN_VERSION = "v1";
const CALENDAR_TOKEN_TTL_SECONDS = 5 * 60;
const MINIMUM_SECRET_LENGTH = 32;
const NONCE_BYTE_LENGTH = 16;
const textEncoder = new TextEncoder();

function assertSecret(secret) {
  if (typeof secret !== "string" || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(
      "Calendar access secret must be at least 32 characters.",
    );
  }
}

function encodeBase64Url(bytes) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Invalid base64url.");
  }

  const paddingLength = (4 - (value.length % 4)) % 4;
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(`${base64}${"=".repeat(paddingLength)}`);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function buildSignatureInput({
  clientIp,
  expiresAtSeconds,
  nonce,
  userAgent,
  villaId,
}) {
  return [
    CALENDAR_TOKEN_VERSION,
    villaId,
    String(expiresAtSeconds),
    nonce,
    clientIp,
    userAgent,
  ].join("\n");
}

async function importHmacKey(secret, usages) {
  assertSecret(secret);

  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC",
    },
    false,
    usages,
  );
}

export async function createBookingCalendarHmacIdentifier({
  parts,
  secret,
}) {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(parts.join("\n")),
  );

  return encodeBase64Url(new Uint8Array(signature));
}

export async function createBookingCalendarToken({
  clientIp,
  nonceBytes,
  nowMs = Date.now(),
  secret,
  userAgent,
  villaId,
}) {
  const resolvedNonceBytes =
    nonceBytes ?? crypto.getRandomValues(new Uint8Array(NONCE_BYTE_LENGTH));

  if (
    !(resolvedNonceBytes instanceof Uint8Array) ||
    resolvedNonceBytes.length !== NONCE_BYTE_LENGTH
  ) {
    throw new Error("Calendar access token nonce must contain 16 bytes.");
  }

  const expiresAtSeconds =
    Math.floor(nowMs / 1_000) + CALENDAR_TOKEN_TTL_SECONDS;
  const nonce = encodeBase64Url(resolvedNonceBytes);
  const signatureInput = buildSignatureInput({
    clientIp,
    expiresAtSeconds,
    nonce,
    userAgent,
    villaId,
  });
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(signatureInput),
  );
  const token = [
    CALENDAR_TOKEN_VERSION,
    String(expiresAtSeconds),
    nonce,
    encodeBase64Url(new Uint8Array(signature)),
  ].join(".");

  return {
    expiresAt: expiresAtSeconds * 1_000,
    token,
  };
}

export async function verifyBookingCalendarToken({
  clientIp,
  nowMs = Date.now(),
  secret,
  token,
  userAgent,
  villaId,
}) {
  assertSecret(secret);

  if (typeof token !== "string") {
    return { valid: false, reason: "format" };
  }

  const parts = token.split(".");

  if (parts.length !== 4 || parts[0] !== CALENDAR_TOKEN_VERSION) {
    return { valid: false, reason: "format" };
  }

  const [, expiresValue, nonce, signatureValue] = parts;

  if (
    !/^\d+$/u.test(expiresValue) ||
    !/^[A-Za-z0-9_-]{22}$/u.test(nonce)
  ) {
    return { valid: false, reason: "format" };
  }

  const expiresAtSeconds = Number(expiresValue);

  if (
    !Number.isSafeInteger(expiresAtSeconds) ||
    expiresAtSeconds * 1_000 <= nowMs
  ) {
    return { valid: false, reason: "expired" };
  }

  let signature;

  try {
    signature = decodeBase64Url(signatureValue);
  } catch {
    return { valid: false, reason: "format" };
  }

  const signatureInput = buildSignatureInput({
    clientIp,
    expiresAtSeconds,
    nonce,
    userAgent,
    villaId,
  });
  const key = await importHmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    textEncoder.encode(signatureInput),
  );

  return valid
    ? { tokenId: signatureValue, valid: true }
    : { valid: false, reason: "signature" };
}
