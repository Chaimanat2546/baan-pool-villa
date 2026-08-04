export const CACHE_OPERATION_TIMEOUT_MS = 1_500;
export const CACHE_RETRY_DELAY_MS = 50;
export const MAX_CACHE_ATTEMPTS = 2;

const TRANSIENT_CACHE_ERROR_MESSAGES = [
  "connection reset",
  "connection timed out",
  "network connection lost",
  "network error",
  "service unavailable",
  "temporary failure",
  "temporarily unavailable",
];

const MAX_ERROR_CAUSE_DEPTH = 8;

class CacheOperationTimeoutError extends Error {
  constructor() {
    super("Cache operation timed out");
  }
}

function delay(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function normalizeCacheErrorValue(value) {
  return typeof value === "string"
    ? value.toLowerCase().replaceAll(/\s+/g, " ").trim()
    : "";
}

function getErrorProperty(error, property) {
  try {
    return error?.[property];
  } catch {
    return undefined;
  }
}

function getCacheErrorValues(error) {
  const values = [];
  const visited = new Set();
  let current = error;

  for (
    let depth = 0;
    current != null && depth < MAX_ERROR_CAUSE_DEPTH;
    depth += 1
  ) {
    if (typeof current === "string") {
      values.push(normalizeCacheErrorValue(current));
      break;
    }

    if (typeof current !== "object" || visited.has(current)) {
      break;
    }

    visited.add(current);

    for (const property of ["message", "name", "code"]) {
      const value = normalizeCacheErrorValue(
        getErrorProperty(current, property),
      );

      if (value) {
        values.push(value);
      }
    }

    current = getErrorProperty(current, "cause");
  }

  return values;
}

function isApprovedCloudflareTransientShape(value) {
  const compactValue = value.replaceAll(/[^a-z0-9]+/g, "");

  return (
    compactValue.includes("daemondown") ||
    (compactValue.includes("internal") && compactValue.includes("binding"))
  );
}

function isTransientCacheError(error) {
  return getCacheErrorValues(error).some(
    (value) =>
      isApprovedCloudflareTransientShape(value) ||
      TRANSIENT_CACHE_ERROR_MESSAGES.some((pattern) =>
        value.includes(pattern),
      ),
  );
}

function getCacheErrorCategory(error) {
  if (error instanceof CacheOperationTimeoutError) {
    return "timeout";
  }

  return isTransientCacheError(error) ? "transient" : "permanent";
}

function logCacheFailure({ cacheKind, operation, routeKind, attempt, error }) {
  console.warn({
    cacheKind,
    operation,
    routeKind,
    attempt,
    errorCategory: getCacheErrorCategory(error),
  });
}

function withTimeout(run, timeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new CacheOperationTimeoutError());
    }, timeout);

    Promise.resolve()
      .then(run)
      .then(
        (value) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      );
  });
}

async function runCacheOperation({ cacheKind, operation, routeKind, run }) {
  for (let attempt = 1; attempt <= MAX_CACHE_ATTEMPTS; attempt += 1) {
    try {
      return {
        ok: true,
        value: await withTimeout(run, CACHE_OPERATION_TIMEOUT_MS),
      };
    } catch (error) {
      logCacheFailure({ cacheKind, operation, routeKind, attempt, error });

      if (attempt === MAX_CACHE_ATTEMPTS || !isTransientCacheError(error)) {
        return { ok: false };
      }

      await delay(CACHE_RETRY_DELAY_MS);
    }
  }

  return { ok: false };
}

export function runCacheRead(options) {
  return runCacheOperation(options);
}

export function scheduleCacheWrite(ctx, options) {
  const write = runCacheOperation(options).then(() => undefined, () => undefined);

  ctx.waitUntil(write);
}
