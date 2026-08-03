const CANONICAL_RFC_9562_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalRfc9562Uuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    CANONICAL_RFC_9562_UUID_PATTERN.test(value)
  );
}
