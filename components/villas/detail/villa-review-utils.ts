export function formatRelativeReviewTime(
  iso: string,
  now = Date.now(),
): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "ไม่ทราบเวลา";
  const seconds = Math.max(0, (now - timestamp) / 1_000);
  if (seconds < 60) return "เมื่อสักครู่";
  for (const [duration, label] of [
    [31_536_000, "ปี"],
    [2_592_000, "เดือน"],
    [86_400, "วัน"],
    [3_600, "ชั่วโมง"],
    [60, "นาที"],
  ] as const) {
    if (seconds >= duration)
      return `${Math.floor(seconds / duration)} ${label}ที่แล้ว`;
  }
  return "เมื่อสักครู่";
}

export function safeReviewImageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isLocalHttp =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname);
    return (url.protocol === "https:" || isLocalHttp) &&
      !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
