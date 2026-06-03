import { normalizeGuideHouseId } from "@/lib/guides/validation";

export function formatCommaSeparatedInput(values: string[]): string {
  return values.join(",");
}

export function parseCommaSeparatedTags(value: string): string[] {
  return value
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseRecommendedHouseIdsInput(value: string): string[] {
  return value
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((houseId) => normalizeGuideHouseId(houseId) ?? houseId);
}
