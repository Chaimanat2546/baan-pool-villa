import "server-only";
import {
  guardAnalyticsRequest,
  analyticsFailure,
  ANALYTICS_NO_STORE,
} from "@/worker-analytics-access.js";
import { validateAnalyticsEvent, validateReportQuery } from "./validation";
import {
  recordAnalyticsEvent,
  getAnalyticsReport,
  getAnalyticsHealth,
} from "./server";
import { AnalyticsError } from "./types";

export async function readAnalyticsJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new AnalyticsError("INVALID_JSON", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new AnalyticsError("BODY_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new AnalyticsError("INVALID_JSON", 400);
  }
}
export async function handleAnalyticsRequest(request: Request) {
  try {
    // Worker enforces binding quota before OpenNext. Repeat authorization here
    // without trusting client-supplied 'already authorized' headers.
    const rejected = await guardAnalyticsRequest(request, process.env, false);
    if (rejected) return rejected;
    const path = new URL(request.url).pathname;
    let body: unknown;
    let status = 200;
    if (path.endsWith("/health")) body = await getAnalyticsHealth();
    else if (path.endsWith("/events")) {
      const event = validateAnalyticsEvent(await readAnalyticsJson(request));
      const result = await recordAnalyticsEvent(event);
      status = result === "stored" ? 201 : 200;
      body = { status: result, event_id: event.event_id };
    } else {
      const { query } = validateReportQuery(await readAnalyticsJson(request));
      body = await getAnalyticsReport(query);
      if (
        new TextEncoder().encode(JSON.stringify(body)).byteLength >
        3 * 1024 * 1024
      )
        throw new AnalyticsError("REPORT_TOO_LARGE", 422);
    }
    return Response.json(body, {
      status,
      headers: { "Cache-Control": ANALYTICS_NO_STORE },
    });
  } catch (error) {
    return error instanceof AnalyticsError
      ? analyticsFailure(error.code, error.status)
      : analyticsFailure("STORAGE_UNAVAILABLE", 503);
  }
}
