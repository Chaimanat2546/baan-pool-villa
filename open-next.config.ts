import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";
import r2IncrementalCacheWithDiagnostics from "./open-next-r2-incremental-cache-diagnostics.js";

export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCacheWithDiagnostics, {
    mode: "long-lived",
  }),
  queue: doQueue,
  tagCache: doShardedTagCache({
    baseShardSize: 4,
    regionalCache: false,
  }),
});
