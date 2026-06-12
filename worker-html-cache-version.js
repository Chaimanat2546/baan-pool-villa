export const HTML_CACHE_VERSION_STORAGE_PREFIX = "html-cache-versions/";

const DEFAULT_VERSION = "0";
const MEMORY_TTL_MS = 15_000;
const memoryCache = new Map();

function getStorageKey(group) {
  return `${HTML_CACHE_VERSION_STORAGE_PREFIX}${group}`;
}

function getVersionStore(env) {
  if (env?.BPV_HTML_CACHE_VERSIONS) {
    return { binding: env.BPV_HTML_CACHE_VERSIONS, type: "kv" };
  }

  if (env?.NEXT_INC_CACHE_R2_BUCKET) {
    return { binding: env.NEXT_INC_CACHE_R2_BUCKET, type: "r2" };
  }

  return null;
}

async function readVersionFromStore(env, group) {
  const store = getVersionStore(env);

  if (!store) {
    return DEFAULT_VERSION;
  }

  const key = getStorageKey(group);

  if (store.type === "kv") {
    return (await store.binding.get(key)) ?? DEFAULT_VERSION;
  }

  const object = await store.binding.get(key);

  return object ? await object.text() : DEFAULT_VERSION;
}

async function writeVersionToStore(env, group, version) {
  const store = getVersionStore(env);

  if (!store) {
    return;
  }

  await store.binding.put(getStorageKey(group), version);
}

async function getCachedVersion(env, group, now) {
  const cached = memoryCache.get(group);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await readVersionFromStore(env, group);
  memoryCache.set(group, {
    expiresAt: now + MEMORY_TTL_MS,
    value,
  });

  return value;
}

export function clearHtmlCacheVersionMemoryCache() {
  memoryCache.clear();
}

export async function getHtmlEdgeCacheVersionToken(env, groups, now = Date.now()) {
  if (!groups?.length) {
    return "";
  }

  const versions = await Promise.all(
    groups.map(async (group) => `${group}:${await getCachedVersion(env, group, now)}`),
  );

  return versions.join("|");
}

export async function writeHtmlEdgeCacheVersions(env, groups, version) {
  if (!groups?.length) {
    return;
  }

  await Promise.all(
    groups.map(async (group) => {
      memoryCache.delete(group);
      await writeVersionToStore(env, group, version);
    }),
  );
}
