export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).split("<").join("\\u003c");
}
