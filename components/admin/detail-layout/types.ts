import type {
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutMainSplit,
  DetailLayoutNarrowRow,
  DetailLayoutOuterRatio,
  DetailLayoutConfig,
  DetailLayoutRatio,
  DetailLayoutRow,
  DetailLayoutV2Config,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
  DetailLayoutWideRow,
  AnyDetailLayoutConfig,
} from "@/lib/detail-layout/types";

export interface AdminDetailLayoutResponse {
  code?: string;
  details?: string;
  error?: string;
  errors?: string[];
  hint?: string;
  layout?: AnyDetailLayoutConfig;
}

export type DetailLayoutDraftSlot = DetailLayoutBlock | null;

export interface DetailLayoutDraftRow
  extends Omit<DetailLayoutRow, "blocks"> {
  blocks: DetailLayoutDraftSlot[];
}

export interface DetailLayoutDraft
  extends Omit<DetailLayoutConfig, "rows"> {
  rows: DetailLayoutDraftRow[];
}

export interface DetailLayoutV2DraftWideRow
  extends Omit<DetailLayoutWideRow, "blocks"> {
  blocks: DetailLayoutDraftSlot[];
}

export interface DetailLayoutV2DraftNarrowRow
  extends Omit<DetailLayoutNarrowRow, "block"> {
  block: DetailLayoutDraftSlot;
}

export interface DetailLayoutV2DraftMainSplit
  extends Omit<DetailLayoutMainSplit, "wideRows" | "narrowRows"> {
  wideRows: DetailLayoutV2DraftWideRow[];
  narrowRows: DetailLayoutV2DraftNarrowRow[];
}

export interface DetailLayoutV2Draft
  extends Omit<DetailLayoutV2Config, "mainSplit"> {
  mainSplit: DetailLayoutV2DraftMainSplit;
}

export type {
  AnyDetailLayoutConfig,
  DetailLayoutBlock,
  DetailLayoutBlockType,
  DetailLayoutColumns,
  DetailLayoutConfig,
  DetailLayoutMainSplit,
  DetailLayoutNarrowRow,
  DetailLayoutOuterRatio,
  DetailLayoutRatio,
  DetailLayoutRow,
  DetailLayoutV2Config,
  DetailLayoutWideColumns,
  DetailLayoutWideRatio,
  DetailLayoutWideRow,
};
