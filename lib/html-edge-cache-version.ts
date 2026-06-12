import "server-only";

import {
  HTML_CACHE_VERSION_GROUPS,
} from "../worker-cache-policy.js";
import {
  writeHtmlEdgeCacheVersions,
} from "../worker-html-cache-version.js";

type HtmlCacheVersionEnv = {
  BPV_HTML_CACHE_VERSIONS?: unknown;
  NEXT_INC_CACHE_R2_BUCKET?: unknown;
};

type WaitUntilContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export { HTML_CACHE_VERSION_GROUPS };

function createHtmlCacheVersionValue(): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? "no-crypto";

  return `${Date.now()}-${randomId}`;
}

export async function writeHtmlEdgeCacheVersionGroupsForContext({
  ctx,
  env,
  groups,
  version = createHtmlCacheVersionValue(),
}: {
  ctx?: WaitUntilContext;
  env: HtmlCacheVersionEnv;
  groups: string[];
  version?: string;
}): Promise<void> {
  const writePromise = writeHtmlEdgeCacheVersions(env, groups, version).catch(
    () => undefined,
  );

  if (ctx?.waitUntil) {
    ctx.waitUntil(writePromise);
  }

  await writePromise;
}

export async function bumpHtmlEdgeCacheVersions(groups: string[]): Promise<void> {
  if (groups.length === 0) {
    return;
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cloudflareContext = await getCloudflareContext({ async: true });
    const env = cloudflareContext.env as HtmlCacheVersionEnv;
    const ctx = cloudflareContext.ctx as WaitUntilContext | undefined;
    await writeHtmlEdgeCacheVersionGroupsForContext({ ctx, env, groups });
  } catch {
    // HTML edge cache versioning is a freshness accelerator. Next data-cache
    // revalidation remains the source of truth when bindings are unavailable.
  }
}
