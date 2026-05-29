import {
  DEFAULT_DETAIL_LAYOUT_V2,
  DETAIL_LAYOUT_BLOCK_LABELS,
  DETAIL_LAYOUT_OUTER_SPLIT_RATIOS,
  DETAIL_LAYOUT_WIDE_ROW_RATIOS,
} from "./defaults";
import {
  DETAIL_LAYOUT_BLOCK_TYPES,
  type DetailLayoutBlock,
  type DetailLayoutBlockType,
  type DetailLayoutConfig,
  type DetailLayoutLockedTop,
  type DetailLayoutNarrowRow,
  type DetailLayoutOuterRatio,
  type DetailLayoutRow,
  type DetailLayoutV2Config,
  type DetailLayoutV2ValidationResult,
  type DetailLayoutWideColumns,
  type DetailLayoutWideRatio,
  type DetailLayoutWideRow,
} from "./types";
import { validateDetailLayout } from "./validation";

const ALLOWED_BLOCK_TYPES = new Set<string>(DETAIL_LAYOUT_BLOCK_TYPES);
const ALLOWED_LOCKED_TOP = new Set<string>(["gallery", "intro"]);
const ALLOWED_OUTER_RATIOS = new Set<string>(DETAIL_LAYOUT_OUTER_SPLIT_RATIOS);
const ALLOWED_WIDE_COLUMNS = new Set<number>([1, 2]);
const ALLOWED_WIDE_RATIOS = new Set<string>(DETAIL_LAYOUT_WIDE_ROW_RATIOS);

export function cloneDetailLayoutV2(
  layout: DetailLayoutV2Config,
): DetailLayoutV2Config {
  return {
    version: 2,
    lockedTop: [...layout.lockedTop] as DetailLayoutLockedTop,
    mainSplit: {
      ratio: layout.mainSplit.ratio,
      wideRows: layout.mainSplit.wideRows.map((row) => ({
        id: row.id,
        columns: row.columns,
        ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
        enabled: row.enabled,
        blocks: row.blocks.map(cloneBlock),
      })),
      narrowRows: layout.mainSplit.narrowRows.map((row) => ({
        id: row.id,
        enabled: row.enabled,
        block: cloneBlock(row.block),
      })),
    },
    lockedBottom: layout.lockedBottom.map(cloneBlock),
  };
}

export function convertDetailLayoutV1ToV2(
  layout: DetailLayoutConfig,
): DetailLayoutV2Config {
  const wideRows: DetailLayoutWideRow[] = [];
  const narrowRows: DetailLayoutNarrowRow[] = [];
  const lockedBottom: DetailLayoutBlock[] = [];
  const splitRowIndex = layout.rows.findIndex(
    (row) =>
      row.enabled && row.columns === 2 && isOuterRatio(row.ratio) && !hasRecommendedBlock(row),
  );
  const splitRow = splitRowIndex >= 0 ? layout.rows[splitRowIndex] : null;
  const outerRatio = isOuterRatio(splitRow?.ratio) ? splitRow.ratio : "70/30";

  layout.rows.forEach((row, rowIndex) => {
    if (hasRecommendedBlock(row)) {
      lockedBottom.push(
        ...row.blocks
          .filter((block) => block.type === "recommended_villas")
          .map(cloneBlock),
      );
      return;
    }

    if (rowIndex === splitRowIndex && splitRow) {
      appendSplitRow({ narrowRows, row: splitRow, wideRows });
      return;
    }

    appendWideRowsFromBlocks({
      blocks: row.blocks,
      enabled: row.enabled,
      ratio: row.ratio,
      rowId: row.id,
      wideRows,
    });
  });

  return {
    version: 2,
    lockedTop: [...layout.lockedTop] as DetailLayoutLockedTop,
    mainSplit: {
      ratio: outerRatio,
      wideRows: wideRows.length > 0 ? wideRows : cloneDefaultWideRows(),
      narrowRows,
    },
    lockedBottom:
      lockedBottom.length > 0
        ? lockedBottom
        : DEFAULT_DETAIL_LAYOUT_V2.lockedBottom.map(cloneBlock),
  };
}

export function normalizeDetailLayoutV2(value: unknown): DetailLayoutV2Config {
  const result = validateDetailLayoutV2(value);

  if (result.ok) {
    return result.layout;
  }

  if (isRecord(value) && value.version === 1) {
    const versionOneResult = validateDetailLayout(value);

    if (versionOneResult.ok) {
      return convertDetailLayoutV1ToV2(versionOneResult.layout);
    }
  }

  return cloneDetailLayoutV2(DEFAULT_DETAIL_LAYOUT_V2);
}

export function validateDetailLayoutV2(
  value: unknown,
): DetailLayoutV2ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return invalid(["รูปแบบเลย์เอาต์ไม่ถูกต้อง"]);
  }

  if (value.version !== 2) {
    errors.push("เวอร์ชันเลย์เอาต์ต้องเป็น 2");
  }

  const lockedTop = normalizeLockedTop(value.lockedTop, errors);
  const mainSplit = normalizeMainSplit(value.mainSplit, errors);
  const lockedBottom = normalizeLockedBottom(value.lockedBottom, errors);

  if (
    errors.length > 0 ||
    lockedTop === null ||
    mainSplit === null ||
    lockedBottom === null
  ) {
    return invalid(errors);
  }

  return {
    ok: true,
    errors: [],
    layout: {
      version: 2,
      lockedTop,
      mainSplit,
      lockedBottom,
    },
  };
}

function appendSplitRow({
  narrowRows,
  row,
  wideRows,
}: {
  narrowRows: DetailLayoutNarrowRow[];
  row: DetailLayoutRow;
  wideRows: DetailLayoutWideRow[];
}) {
  const [firstBlock, secondBlock] = row.blocks;
  const wideBlock = row.ratio === "30/70" ? secondBlock : firstBlock;
  const narrowBlock = row.ratio === "30/70" ? firstBlock : secondBlock;

  if (wideBlock) {
    wideRows.push({
      id: `${row.id}_wide`,
      columns: 1,
      enabled: row.enabled,
      blocks: [cloneBlock(wideBlock)],
    });
  }

  if (narrowBlock) {
    narrowRows.push({
      id: `${row.id}_narrow`,
      enabled: row.enabled,
      block: cloneBlock(narrowBlock),
    });
  }
}

function appendWideRowsFromBlocks({
  blocks,
  enabled,
  ratio,
  rowId,
  wideRows,
}: {
  blocks: DetailLayoutBlock[];
  enabled: boolean;
  ratio: DetailLayoutRow["ratio"];
  rowId: string;
  wideRows: DetailLayoutWideRow[];
}) {
  for (let index = 0; index < blocks.length; index += 2) {
    const rowBlocks = blocks.slice(index, index + 2).map(cloneBlock);
    const columns = rowBlocks.length === 1 ? 1 : 2;
    const id = index === 0 ? rowId : `${rowId}_${index / 2 + 1}`;

    wideRows.push({
      id,
      columns,
      ...(columns === 2 ? { ratio: toWideRatio(ratio) } : {}),
      enabled,
      blocks: rowBlocks,
    });
  }
}

function cloneDefaultWideRows(): DetailLayoutWideRow[] {
  return DEFAULT_DETAIL_LAYOUT_V2.mainSplit.wideRows.map((row) => ({
    id: row.id,
    columns: row.columns,
    ...(row.ratio === undefined ? {} : { ratio: row.ratio }),
    enabled: row.enabled,
    blocks: row.blocks.map(cloneBlock),
  }));
}

function normalizeMainSplit(
  value: unknown,
  errors: string[],
): DetailLayoutV2Config["mainSplit"] | null {
  if (!isRecord(value)) {
    errors.push("โซนหลักต้องมีข้อมูลฝั่ง 70 และฝั่ง 30");
    return null;
  }

  const ratio = normalizeOuterRatio(value.ratio, errors);
  const wideRows = normalizeWideRows(value.wideRows, errors);
  const narrowRows = normalizeNarrowRows(value.narrowRows, errors);

  if (ratio === null || wideRows === null || narrowRows === null) {
    return null;
  }

  return {
    ratio,
    wideRows,
    narrowRows,
  };
}

function normalizeOuterRatio(
  value: unknown,
  errors: string[],
): DetailLayoutOuterRatio | null {
  if (typeof value !== "string" || !ALLOWED_OUTER_RATIOS.has(value)) {
    errors.push("สัดส่วนโซนหลักต้องเป็น 70/30 หรือ 30/70");
    return null;
  }

  return value as DetailLayoutOuterRatio;
}

function normalizeWideRows(
  value: unknown,
  errors: string[],
): DetailLayoutWideRow[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("ฝั่ง 70 ต้องมีแถวอย่างน้อย 1 แถว");
    return null;
  }

  const rows: DetailLayoutWideRow[] = [];

  value.forEach((item, index) => {
    const rowNumber = index + 1;

    if (!isRecord(item)) {
      errors.push(`แถวฝั่ง 70 ที่ ${rowNumber} มีรูปแบบไม่ถูกต้อง`);
      return;
    }

    const columns = normalizeWideColumns(item.columns, rowNumber, errors);
    const blocks = normalizeBlockList(
      item.blocks,
      `แถวฝั่ง 70 ที่ ${rowNumber}`,
      errors,
    );
    const ratio = normalizeWideRatio(item.ratio, columns, rowNumber, errors);

    if (columns !== null && blocks !== null && blocks.length > columns) {
      errors.push(`แถวฝั่ง 70 ที่ ${rowNumber} มี block มากกว่าจำนวนคอลัมน์`);
    }

    if (columns === null || blocks === null || errors.length > 0) {
      return;
    }

    rows.push({
      id: normalizeId(item.id, `wide_${rowNumber}`),
      columns,
      ...(ratio === undefined ? {} : { ratio }),
      enabled: normalizeBoolean(item.enabled, true),
      blocks,
    });
  });

  return errors.length === 0 ? rows : null;
}

function normalizeWideColumns(
  value: unknown,
  rowNumber: number,
  errors: string[],
): DetailLayoutWideColumns | null {
  if (typeof value !== "number" || !ALLOWED_WIDE_COLUMNS.has(value)) {
    errors.push(`แถวฝั่ง 70 ที่ ${rowNumber} ต้องมี 1 หรือ 2 คอลัมน์`);
    return null;
  }

  return value as DetailLayoutWideColumns;
}

function normalizeWideRatio(
  value: unknown,
  columns: DetailLayoutWideColumns | null,
  rowNumber: number,
  errors: string[],
): DetailLayoutWideRatio | undefined {
  if (columns === null) {
    return undefined;
  }

  if (columns === 1) {
    if (value !== undefined) {
      errors.push(`แถวฝั่ง 70 ที่ ${rowNumber} แบบ 1 คอลัมน์ต้องไม่มีสัดส่วน`);
    }

    return undefined;
  }

  if (typeof value !== "string" || !ALLOWED_WIDE_RATIOS.has(value)) {
    errors.push(
      `แถวฝั่ง 70 ที่ ${rowNumber} ต้องใช้สัดส่วน 50/50, 60/40 หรือ 40/60`,
    );
    return undefined;
  }

  return value as DetailLayoutWideRatio;
}

function normalizeNarrowRows(
  value: unknown,
  errors: string[],
): DetailLayoutNarrowRow[] | null {
  if (!Array.isArray(value)) {
    errors.push("ฝั่ง 30 ต้องมีรายการแถว");
    return null;
  }

  const rows: DetailLayoutNarrowRow[] = [];

  value.forEach((item, index) => {
    const rowNumber = index + 1;

    if (!isRecord(item)) {
      errors.push(`แถวฝั่ง 30 ที่ ${rowNumber} มีรูปแบบไม่ถูกต้อง`);
      return;
    }

    const block = normalizeBlock(
      item.block,
      `แถวฝั่ง 30 ที่ ${rowNumber}`,
      errors,
    );

    if (block === null || errors.length > 0) {
      return;
    }

    rows.push({
      id: normalizeId(item.id, `narrow_${rowNumber}`),
      enabled: normalizeBoolean(item.enabled, true),
      block,
    });
  });

  return errors.length === 0 ? rows : null;
}

function normalizeLockedBottom(
  value: unknown,
  errors: string[],
): DetailLayoutBlock[] | null {
  const blocks = normalizeBlockList(value, "บ้านพักแนะนำ", errors);

  if (blocks === null) {
    return null;
  }

  if (!blocks.some((block) => block.type === "recommended_villas")) {
    errors.push("บ้านพักแนะนำต้องเป็น block แบบ recommended_villas");
    return null;
  }

  return blocks;
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

function normalizeBlockList(
  value: unknown,
  context: string,
  errors: string[],
): DetailLayoutBlock[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${context} ต้องมี block อย่างน้อย 1 รายการ`);
    return null;
  }

  const blocks: DetailLayoutBlock[] = [];

  value.forEach((item) => {
    const block = normalizeBlock(item, context, errors);

    if (block) {
      blocks.push(block);
    }
  });

  return errors.length === 0 ? blocks : null;
}

function normalizeBlock(
  value: unknown,
  context: string,
  errors: string[],
): DetailLayoutBlock | null {
  if (!isRecord(value)) {
    errors.push(`${context} มีรูปแบบ block ไม่ถูกต้อง`);
    return null;
  }

  if (typeof value.type !== "string" || !ALLOWED_BLOCK_TYPES.has(value.type)) {
    errors.push(`${context} มี block ที่ไม่รองรับ`);
    return null;
  }

  const type = value.type as DetailLayoutBlockType;

  return {
    type,
    title: normalizeBlockTitle(value.title, type),
    enabled: normalizeBoolean(value.enabled, true),
    hideWhenEmpty: normalizeBoolean(value.hideWhenEmpty, true),
  };
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

function invalid(errors: string[]): DetailLayoutV2ValidationResult {
  return {
    ok: false,
    errors,
    layout: cloneDetailLayoutV2(DEFAULT_DETAIL_LAYOUT_V2),
  };
}

function hasRecommendedBlock(row: DetailLayoutRow): boolean {
  return row.blocks.some((block) => block.type === "recommended_villas");
}

function cloneBlock(block: DetailLayoutBlock): DetailLayoutBlock {
  return { ...block };
}

function isOuterRatio(
  value: DetailLayoutRow["ratio"],
): value is DetailLayoutOuterRatio {
  return value === "70/30" || value === "30/70";
}

function toWideRatio(
  value: DetailLayoutRow["ratio"],
): DetailLayoutWideRatio {
  return value === "60/40" || value === "40/60" ? value : "50/50";
}

function normalizeId(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
