import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getAnalyticsConfig } from "./config";
import {
  AnalyticsError,
  type AnalyticsEventInput,
  type AnalyticsReportQuery,
} from "./types";
import { fetchHouseListings } from "@/lib/villas/server";

async function rpc(name: string, args: Record<string, unknown>) {
  const config = getAnalyticsConfig();
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { timeout: 10000 },
  });
  const { data, error } = await client.rpc(name, {
    ...args,
    p_site_id: config.siteId,
  });
  if (error) {
    if (error.message.includes("EVENT_ID_CONFLICT"))
      throw new AnalyticsError("EVENT_ID_CONFLICT", 409);
    if (error.message.includes("REPORT_TOO_LARGE"))
      throw new AnalyticsError("REPORT_TOO_LARGE", 422);
    throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
  }
  return data;
}
export async function recordAnalyticsEvent(
  event: AnalyticsEventInput,
): Promise<"stored" | "duplicate"> {
  if (event.villa_id !== null) {
    let known: boolean;
    try {
      known = (await fetchHouseListings()).some((v) => v.id === event.villa_id);
    } catch {
      throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
    }
    if (!known) throw new AnalyticsError("INVALID_EVENT", 422);
  }
  const result = await rpc("analytics_insert_event", { p_event: event });
  if (result !== "stored" && result !== "duplicate")
    throw new AnalyticsError("STORAGE_UNAVAILABLE", 503);
  return result;
}
export async function getAnalyticsReport(
  query: AnalyticsReportQuery,
): Promise<unknown> {
  return rpc("analytics_report", { p_query: query });
}
export async function getAnalyticsHealth() {
  await rpc("analytics_initialize", {});
  return {
    site_id: getAnalyticsConfig().siteId,
    contract_version: "1.0",
    ready: true,
  };
}
