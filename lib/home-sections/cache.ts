import "server-only";

import { unstable_cache } from "next/cache";

import { getHomeConfigCacheNamespace } from "./environment";

type CacheOptions = {
  revalidate?: number | false;
  tags?: string[];
};

/**
 * Wraps a Home Config loader so Next includes the owning Supabase project in
 * every persistent cache key while preserving the loader's public signature.
 */
export function createHomeConfigCachedLoader<
  TArguments extends unknown[],
  TResult,
>(
  loader: (...args: TArguments) => Promise<TResult>,
  keyParts?: string[],
  options?: CacheOptions,
) {
  const cachedLoader = unstable_cache(
    async (_namespace: string, ...args: TArguments) => loader(...args),
    keyParts,
    options,
  );

  return (...args: TArguments) =>
    cachedLoader(getHomeConfigCacheNamespace(), ...args);
}
