import {
  closestCorners,
  type CollisionDetection,
  type UniqueIdentifier,
} from "@dnd-kit/core";

import { isDetailLayoutBlockType } from "./detail-layout-helpers";
import type { DetailLayoutBlockType } from "./types";

type ParsedId =
  | { type: "wide-row" | "narrow-row" | "narrow-block"; rowId: string }
  | { type: "wide-block" | "wide-slot"; rowId: string; blockIndex: number }
  | { type: "narrow-slot"; rowId: string }
  | { type: "library"; blockType: DetailLayoutBlockType };

export function parseDetailLayoutDndId(id: UniqueIdentifier): ParsedId | null {
  if (typeof id !== "string") return null;
  const parts = id.split(":");
  if ((parts[0] === "wide-row" || parts[0] === "narrow-row" || parts[0] === "narrow-block") && parts.length === 2 && parts[1]) return { type: parts[0], rowId: parts[1] };
  if ((parts[0] === "wide-block" || parts[0] === "wide-slot") && parts.length === 3 && parts[1] && /^\d+$/.test(parts[2])) return { type: parts[0], rowId: parts[1], blockIndex: Number(parts[2]) };
  if (parts[0] === "narrow-slot" && parts.length === 2 && parts[1]) return { type: "narrow-slot", rowId: parts[1] };
  if (parts[0] === "library" && parts[1] === "block" && parts.length === 3 && isDetailLayoutBlockType(parts[2])) return { type: "library", blockType: parts[2] };
  return null;
}

export function getCompatibleDetailLayoutDropTargetIds(
  activeId: UniqueIdentifier,
  candidateIds: readonly UniqueIdentifier[],
) {
  const active = parseDetailLayoutDndId(activeId);

  if (!active) {
    return [];
  }

  return candidateIds.filter((candidateId) => {
    const candidate = parseDetailLayoutDndId(candidateId);

    if (!candidate) {
      return false;
    }

    if (active.type === "wide-row") {
      return candidate.type === "wide-row";
    }

    if (active.type === "narrow-row") {
      return candidate.type === "narrow-row";
    }

    return candidate.type === "wide-slot" || candidate.type === "narrow-slot";
  });
}

export const detailLayoutCollisionDetection: CollisionDetection = (args) => {
  const compatibleTargetIds = new Set(
    getCompatibleDetailLayoutDropTargetIds(
      args.active.id,
      args.droppableContainers.map(({ id }) => id),
    ),
  );

  return closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter(({ id }) =>
      compatibleTargetIds.has(id),
    ),
  });
};

export function resolveDetailLayoutDrop(activeId: UniqueIdentifier, overId: UniqueIdentifier) {
  const active = parseDetailLayoutDndId(activeId); const over = parseDetailLayoutDndId(overId);
  if (!active || !over) return null;
  if (active.type === "wide-row" && over.type === "wide-row") return { kind: "moveWideRow" as const, fromRowId: active.rowId, toRowId: over.rowId };
  if (active.type === "narrow-row" && over.type === "narrow-row") return { kind: "moveNarrowRow" as const, fromRowId: active.rowId, toRowId: over.rowId };
  if (active.type === "wide-block" && over.type === "wide-slot") return { kind: "moveWideBlock" as const, fromRowId: active.rowId, fromBlockIndex: active.blockIndex, toRowId: over.rowId, toBlockIndex: over.blockIndex };
  if (active.type === "wide-block" && over.type === "narrow-slot") return { kind: "moveWideToNarrow" as const, fromRowId: active.rowId, fromBlockIndex: active.blockIndex, toRowId: over.rowId };
  if (active.type === "narrow-block" && over.type === "wide-slot") return { kind: "moveNarrowToWide" as const, fromRowId: active.rowId, toRowId: over.rowId, toBlockIndex: over.blockIndex };
  if (active.type === "narrow-block" && over.type === "narrow-slot") return { kind: "moveNarrowBlock" as const, fromRowId: active.rowId, toRowId: over.rowId };
  if (active.type === "library" && over.type === "wide-slot") return { kind: "copyLibraryBlock" as const, type: active.blockType, zone: "wide" as const, rowId: over.rowId, blockIndex: over.blockIndex };
  if (active.type === "library" && over.type === "narrow-slot") return { kind: "copyLibraryBlock" as const, type: active.blockType, zone: "narrow" as const, rowId: over.rowId };
  return null;
}
