import { createHash } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IgnorableError } from "@opennextjs/aws/utils/error.js";

const R2_BINDING_NAME = "NEXT_INC_CACHE_R2_BUCKET";
const R2_PREFIX_ENV_NAME = "NEXT_INC_CACHE_R2_PREFIX";
const DEFAULT_R2_PREFIX = "incremental-cache";
const FALLBACK_BUILD_ID = "no-build-id";
const CACHE_KEY_FINGERPRINT_LENGTH = 16;

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getCacheType(cacheType) {
  return cacheType === "fetch" ? "fetch" : "cache";
}

function getErrorValues(error) {
  const values = [];
  const visited = new Set();
  let current = error;

  for (let depth = 0; current != null && depth < 8; depth += 1) {
    if (typeof current === "string") {
      values.push(current);
      break;
    }

    if (typeof current !== "object" || visited.has(current)) {
      break;
    }

    visited.add(current);

    for (const property of ["code", "message", "name"]) {
      try {
        const value = current[property];

        if (typeof value === "string") {
          values.push(value);
        }
      } catch {
        // An error object's custom getter must not disrupt cache handling.
      }
    }

    try {
      current = current.cause;
    } catch {
      break;
    }
  }

  return values;
}

function getErrorClassification(error) {
  const normalized = getErrorValues(error)
    .join(" ")
    .toLowerCase();

  if (normalized.includes("10058")) {
    return { errorCode: "10058", errorKind: "concurrent_object_write" };
  }

  return { errorCode: "unknown", errorKind: "other" };
}

export function createR2CacheWriteDiagnostic({ cacheKey, cacheType, error }) {
  return {
    cacheKeyFingerprint: hash(String(cacheKey)).slice(
      0,
      CACHE_KEY_FINGERPRINT_LENGTH,
    ),
    cacheType: getCacheType(cacheType),
    ...getErrorClassification(error),
    operation: "r2_incremental_cache_set",
  };
}

function getR2Key(key, cacheType) {
  const { env } = getCloudflareContext();
  const prefix = env[R2_PREFIX_ENV_NAME] ?? DEFAULT_R2_PREFIX;
  const buildId = process.env.OPEN_NEXT_BUILD_ID ?? FALLBACK_BUILD_ID;

  return `${prefix}/${buildId}/${hash(key)}.${getCacheType(cacheType)}`.replace(
    /\/+/g,
    "/",
  );
}

const r2IncrementalCacheWithDiagnostics = {
  name: "cf-r2-incremental-cache",

  async get(key, cacheType) {
    const r2 = getCloudflareContext().env[R2_BINDING_NAME];

    if (!r2) {
      throw new IgnorableError("No R2 bucket");
    }

    try {
      const r2Object = await r2.get(getR2Key(key, cacheType));

      if (!r2Object) {
        return null;
      }

      return {
        lastModified: r2Object.uploaded.getTime(),
        value: await r2Object.json(),
      };
    } catch (error) {
      console.error("Failed to get from cache", error);
      return null;
    }
  },

  async set(key, value, cacheType) {
    const r2 = getCloudflareContext().env[R2_BINDING_NAME];

    if (!r2) {
      throw new IgnorableError("No R2 bucket");
    }

    try {
      await r2.put(getR2Key(key, cacheType), JSON.stringify(value));
    } catch (error) {
      console.error(
        "OpenNext R2 incremental cache write failed",
        createR2CacheWriteDiagnostic({
          cacheKey: key,
          cacheType,
          error,
        }),
      );
    }
  },

  async delete(key) {
    const r2 = getCloudflareContext().env[R2_BINDING_NAME];

    if (!r2) {
      throw new IgnorableError("No R2 bucket");
    }

    try {
      await r2.delete(getR2Key(key));
    } catch (error) {
      console.error("Failed to delete from cache", error);
    }
  },
};

export default r2IncrementalCacheWithDiagnostics;
