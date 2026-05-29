import {
  DEFAULT_DETAIL_LAYOUT,
  DETAIL_LAYOUT_ALLOWED_RATIOS,
  DETAIL_LAYOUT_BLOCK_LABELS,
} from "./defaults";
import {
  DETAIL_LAYOUT_BLOCK_TYPES,
  type DetailLayoutBlock,
  type DetailLayoutBlockType,
  type DetailLayoutColumns,
  type DetailLayoutConfig,
  type DetailLayoutLockedTop,
  type DetailLayoutRatio,
  type DetailLayoutRow,
  type DetailLayoutValidationResult,
} from "./types";

const ALLOWED_BLOCK_TYPES = new Set<string>(DETAIL_LAYOUT_BLOCK_TYPES);
const ALLOWED_COLUMNS = new Set<number>([1, 2, 3]);
const ALLOWED_LOCKED_TOP = new Set<string>(["gallery", "intro"]);
const ALLOWED_RATIOS = new Set<string>(DETAIL_LAYOUT_ALLOWED_RATIOS);

export function cloneDetailLayout(
  layout: DetailLayoutConfig,
): DetailLayoutConfig {
  return {
    version: layout.version,
    lockedTop: [...layout.lockedTop] as DetailLayoutLockedTop,
    rows: layout.rows.map((row) => ({
      id: row.id,
      columns: row.columns,
      ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
      enabled: row.enabled,
      blocks: row.blocks.map((block) => ({ ...block })),
    })),
  };
}

export function normalizeDetailLayout(value: unknown): DetailLayoutConfig {
  const result = validateDetailLayout(value);

  return result.ok ? result.layout : cloneDetailLayout(DEFAULT_DETAIL_LAYOUT);
}

export function validateDetailLayout(
  value: unknown,
): DetailLayoutValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return invalid(["รูปแบบเลย์เอาต์ไม่ถูกต้อง"]);
  }

  if (value.version !== 1) {
    errors.push("เวอร์ชันเลย์เอาต์ไม่ถูกต้อง");
  }

  const lockedTop = normalizeLockedTop(value.lockedTop, errors);
  const rows = normalizeRows(value.rows, errors);

  if (errors.length > 0 || lockedTop === null || rows === null) {
    return invalid(errors);
  }

  return {
    ok: true,
    errors: [],
    layout: {
      version: 1,
      lockedTop,
      rows,
    },
  };
}

export function moveDetailLayoutRow(
  layout: DetailLayoutConfig,
  fromIndex: number,
  toIndex: number,
): DetailLayoutConfig {
  const clonedLayout = cloneDetailLayout(layout);
  const from = normalizeMoveIndex(fromIndex, clonedLayout.rows.length);
  const to = normalizeMoveIndex(toIndex, clonedLayout.rows.length);

  if (from === null || to === null || from === to) {
    return clonedLayout;
  }

  const [selectedRow] = clonedLayout.rows.splice(from, 1);
  clonedLayout.rows.splice(to, 0, selectedRow);

  return clonedLayout;
}

function invalid(errors: string[]): DetailLayoutValidationResult {
  return {
    ok: false,
    errors,
    layout: cloneDetailLayout(DEFAULT_DETAIL_LAYOUT),
  };
}

function normalizeLockedTop(
  value: unknown,
  errors: string[],
): DetailLayoutLockedTop | null {
  if (!Array.isArray(value) || value.length !== 2) {
    errors.push("ส่วนบนที่ล็อกไว้ต้องเป็นแกลเลอรีและบทนำ");
    return null;
  }

  const lockedTop = value.filter(
    (item): item is DetailLayoutLockedTop[number] =>
      typeof item === "string" && ALLOWED_LOCKED_TOP.has(item),
  );

  if (
    lockedTop.length !== 2 ||
    lockedTop[0] !== "gallery" ||
    lockedTop[1] !== "intro"
  ) {
    errors.push("ส่วนบนที่ล็อกไว้ต้องเป็นแกลเลอรีและบทนำ");
    return null;
  }

  return ["gallery", "intro"];
}

function normalizeRows(
  value: unknown,
  errors: string[],
): DetailLayoutRow[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("ต้องมีแถวอย่างน้อย 1 แถว");
    return null;
  }

  const rows: DetailLayoutRow[] = [];

  value.forEach((item, index) => {
    const rowNumber = index + 1;

    if (!isRecord(item)) {
      errors.push(`แถวที่ ${rowNumber} มีรูปแบบไม่ถูกต้อง`);
      return;
    }

    const columns = normalizeColumns(item.columns, rowNumber, errors);
    const blocks = normalizeBlocks(item.blocks, rowNumber, errors);
    const ratio = normalizeRatio(item.ratio, columns, rowNumber, errors);

    if (columns !== null && blocks !== null && blocks.length > columns) {
      errors.push(`แถวที่ ${rowNumber} มี block มากกว่าจำนวนคอลัมน์`);
    }

    if (columns === null || blocks === null || errors.length > 0) {
      return;
    }

    rows.push({
      id: normalizeRowId(item.id, rowNumber),
      columns,
      ...(ratio === undefined ? {} : { ratio }),
      enabled: normalizeBoolean(item.enabled, true),
      blocks,
    });
  });

  return errors.length === 0 ? rows : null;
}

function normalizeColumns(
  value: unknown,
  rowNumber: number,
  errors: string[],
): DetailLayoutColumns | null {
  if (typeof value !== "number" || !ALLOWED_COLUMNS.has(value)) {
    errors.push(`แถวที่ ${rowNumber} ต้องมี 1, 2 หรือ 3 คอลัมน์`);
    return null;
  }

  return value as DetailLayoutColumns;
}

function normalizeRatio(
  value: unknown,
  columns: DetailLayoutColumns | null,
  rowNumber: number,
  errors: string[],
): DetailLayoutRatio | undefined {
  if (columns === null) {
    return undefined;
  }

  if (columns !== 2) {
    if (value !== undefined) {
      errors.push(`แถวที่ ${rowNumber} ที่ไม่ใช่ 2 คอลัมน์ต้องไม่มีสัดส่วน`);
    }

    return undefined;
  }

  if (typeof value !== "string" || !ALLOWED_RATIOS.has(value)) {
    errors.push(`แถวที่ ${rowNumber} ต้องใช้สัดส่วนที่กำหนดไว้`);
    return undefined;
  }

  return value as DetailLayoutRatio;
}

function normalizeBlocks(
  value: unknown,
  rowNumber: number,
  errors: string[],
): DetailLayoutBlock[] | null {
  if (!Array.isArray(value)) {
    errors.push(`แถวที่ ${rowNumber} ต้องมีรายการ block`);
    return null;
  }

  if (value.length === 0) {
    errors.push(`แถวที่ ${rowNumber} ต้องมี block อย่างน้อย 1 รายการ`);
    return null;
  }

  const blocks: DetailLayoutBlock[] = [];

  value.forEach((item, index) => {
    const blockNumber = index + 1;

    if (!isRecord(item)) {
      errors.push(`แถวที่ ${rowNumber} block ที่ ${blockNumber} มีรูปแบบไม่ถูกต้อง`);
      return;
    }

    if (typeof item.type !== "string" || !ALLOWED_BLOCK_TYPES.has(item.type)) {
      errors.push(`แถวที่ ${rowNumber} มี block ที่ไม่รองรับ`);
      return;
    }

    const type = item.type as DetailLayoutBlockType;

    blocks.push({
      type,
      title: normalizeBlockTitle(item.title, type),
      enabled: normalizeBoolean(item.enabled, true),
      hideWhenEmpty: normalizeBoolean(item.hideWhenEmpty, true),
    });
  });

  return errors.length === 0 ? blocks : null;
}

function normalizeBlockTitle(
  value: unknown,
  type: DetailLayoutBlockType,
): string {
  if (typeof value !== "string") {
    return DETAIL_LAYOUT_BLOCK_LABELS[type];
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 && !hasPlainTextUnsafeCharacter(trimmedValue)
    ? trimmedValue
    : DETAIL_LAYOUT_BLOCK_LABELS[type];
}

function hasPlainTextUnsafeCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index);

    if (value.charAt(index) === "<" || value.charAt(index) === ">") {
      return true;
    }

    if (charCode <= 31 || charCode === 127) {
      return true;
    }
  }

  return false;
}

function normalizeRowId(value: unknown, rowNumber: number): string {
  if (typeof value !== "string") {
    return `row_${rowNumber}`;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : `row_${rowNumber}`;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeMoveIndex(index: number, length: number): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    return null;
  }

  return index;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
