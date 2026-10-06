export async function pruneAnalytics(env) {
  if (env.ANALYTICS_RETENTION_ENABLED !== "true") return;
  const siteId = env.ANALYTICS_SITE_ID;
  const url = env.NEXT_PUBLIC_HOME_CONFIG_SUPABASE_URL;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!siteId || !url || !secret || !env.CENTRAL_USER_MANAGER_PROJECT_REF)
    throw new Error("Analytics retention is not configured");
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    target.hostname !== `${env.CENTRAL_USER_MANAGER_PROJECT_REF}.supabase.co`
  )
    throw new Error("Analytics retention target mismatch");
  for (let batch = 0; batch < 10; batch++) {
    const response = await fetch(
      new URL("/rest/v1/rpc/analytics_prune_events", target),
      {
        method: "POST",
        headers: {
          apikey: secret,
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_site_id: siteId, p_batch_size: 10000 }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("Analytics retention failed");
    const data = await response.json();
    if (
      !Number.isInteger(data.removed) ||
      data.removed < 0 ||
      data.removed > 10000
    )
      throw new Error("Analytics retention failed");
    if (data.removed < 10000) return;
  }
  console.warn(JSON.stringify({ code: "ANALYTICS_RETENTION_BATCH_LIMIT" }));
}
