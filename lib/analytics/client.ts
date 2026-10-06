import { normalizeAnalyticsPath } from "./validation";
import type { TrackInput } from "./types";
const ENDPOINT = "/api/analytics/v1/events";
function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function send(body: string) {
  const controller = new AbortController();
  for (let attempt = 0; attempt < 3; attempt++) {
    let delay = 500 * 2 ** attempt;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status !== 429 && response.status !== 503) return;
      const payload = await response.json().catch(() => null);
      if (payload?.error?.code === "TRACKING_DISABLED") return;
      const retry = response.headers.get("Retry-After");
      if (retry) {
        const seconds = Number(retry);
        delay = Math.max(
          delay,
          Number.isFinite(seconds)
            ? seconds * 1000
            : Date.parse(retry) - Date.now(),
        );
      }
    } catch {
      if (controller.signal.aborted) return;
    }
    if (attempt === 2 || !Number.isFinite(delay) || delay > 60000) return;
    const jitter = crypto.getRandomValues(new Uint16Array(1))[0] % 250;
    if (!(await wait(delay + jitter, controller.signal))) return;
  }
}
export function track(input: TrackInput): void {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(input.page_path, window.location.origin);
    if (url.origin !== window.location.origin) return;
    const page_path = normalizeAnalyticsPath(url.pathname);
    if (!page_path) return;
    const body = JSON.stringify({
      event_name: input.event_name,
      channel: input.channel,
      villa_id: input.villa_id,
      page_path,
      event_id: crypto.randomUUID(),
      schema_version: 1,
    });
    void send(body).catch(() => {});
  } catch {
    /* Measurement must never prevent navigation or contact. */
  }
}
