import {
  FIXED_HOME_SECTION_KEYS,
  type FixedHomeSectionKey,
  type HomePageLayoutItem,
} from "./types";

const fixedKeys = new Set<string>(FIXED_HOME_SECTION_KEYS);

export function buildDefaultHomePageLayout(
  railSlugs: string[],
): HomePageLayoutItem[] {
  const rails = railSlugs.map((key) => ({
    kind: "rail" as const,
    key,
    enabled: true,
  }));
  const tail: HomePageLayoutItem[] = [
    { kind: "fixed", key: "tiktok", enabled: true },
    { kind: "fixed", key: "customer_reviews", enabled: true },
    { kind: "fixed", key: "articles", enabled: true },
    { kind: "fixed", key: "faq", enabled: true },
    { kind: "fixed", key: "contact", enabled: true },
  ];

  return rails.length === 0
    ? [{ kind: "fixed", key: "why_choose", enabled: true }, ...tail]
    : [
        rails[0],
        { kind: "fixed", key: "why_choose", enabled: true },
        ...rails.slice(1),
        ...tail,
      ];
}

export function parseHomePageLayout(value: unknown): {
  errors: string[];
  items: HomePageLayoutItem[];
} {
  if (!Array.isArray(value)) {
    return { errors: ["layout ต้องเป็น array"], items: [] };
  }

  const errors: string[] = [];
  const items: HomePageLayoutItem[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`รายการลำดับที่ ${index + 1} ไม่ถูกต้อง`);
      return;
    }
    const row = item as Record<string, unknown>;
    if (
      (row.kind !== "fixed" && row.kind !== "rail") ||
      typeof row.key !== "string" ||
      typeof row.enabled !== "boolean" ||
      Object.keys(row).some(
        (key) => key !== "kind" && key !== "key" && key !== "enabled",
      )
    ) {
      errors.push(`รายการลำดับที่ ${index + 1} ไม่ถูกต้อง`);
      return;
    }
    if (row.kind === "fixed" && !fixedKeys.has(row.key)) {
      errors.push(`ส่วนของระบบ ${row.key} ไม่รองรับ`);
      return;
    }
    items.push(row as HomePageLayoutItem);
  });

  return { errors, items };
}

export function validateHomePageLayout(
  items: HomePageLayoutItem[],
  railSlugs: string[],
): string[] {
  const errors: string[] = [];
  const configuredRails = new Set(railSlugs);
  const seen = new Set<string>();
  const fixed = new Set<FixedHomeSectionKey>();

  for (const item of items) {
    const identity = `${item.kind}:${item.key}`;
    if (seen.has(identity)) {
      errors.push(`${item.key} ซ้ำ`);
      continue;
    }
    seen.add(identity);
    if (item.kind === "fixed") fixed.add(item.key);
    if (item.kind === "rail" && !configuredRails.has(item.key)) {
      errors.push(`ไม่พบชุดบ้านพัก ${item.key}`);
    }
  }

  if (fixed.size !== FIXED_HOME_SECTION_KEYS.length) {
    errors.push("ส่วนของระบบไม่ครบ");
  }
  if (items.length !== FIXED_HOME_SECTION_KEYS.length + railSlugs.length) {
    errors.push("จำนวนรายการจัดหน้าแรกไม่ตรงกับชุดบ้านพัก");
  }

  return errors;
}

export function moveHomePageLayoutItem(
  items: HomePageLayoutItem[],
  fromIndex: number,
  toIndex: number,
): HomePageLayoutItem[] {
  const next = items.map((item) => ({ ...item }));
  if (
    Number.isInteger(fromIndex) &&
    Number.isInteger(toIndex) &&
    fromIndex >= 0 &&
    toIndex >= 0 &&
    fromIndex < next.length &&
    toIndex < next.length &&
    fromIndex !== toIndex
  ) {
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
  }
  return next;
}
