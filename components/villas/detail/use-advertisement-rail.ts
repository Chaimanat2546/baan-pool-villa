"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicAdvertisement, PublicAdvertisementPage } from "@/lib/advertisements/types";
import { ADVERTISEMENT_IMAGE_LIMIT, ADVERTISEMENT_PAGE_SIZE } from "@/lib/advertisements/types";
import { isAdvertisementId, isRecord, parseAdvertisementCursor, normalizeAdvertisementVillaZone } from "@/lib/advertisements/validation";

function isPublicAdvertisement(value: unknown): value is PublicAdvertisement {
  return isRecord(value) && isAdvertisementId(value.id) && typeof value.title === "string" &&
    typeof value.imageUrl === "string" && value.imageUrl.startsWith("/api/advertisements/images/") &&
    Array.isArray(value.imageUrls) && value.imageUrls.length >= 1 && value.imageUrls.length <= ADVERTISEMENT_IMAGE_LIMIT && value.imageUrl === value.imageUrls[0] &&
    value.imageUrls.every(url => typeof url === "string" && isAdvertisementId(url.slice("/api/advertisements/images/".length)) && url.startsWith("/api/advertisements/images/"));
}

export function useAdvertisementRail(initial: PublicAdvertisement[], initialCursor: string | null, zone: string) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIds, setActiveIds] = useState(() => new Set(initial.slice(0, 4).map(item => item.id)));
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const loadMore = useCallback(async () => {
    if (!cursor || pending.current) return;
    pending.current = true;
    setLoading(true);
    setError(false);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const params = new URLSearchParams({ after: cursor });
      const normalizedZone = normalizeAdvertisementVillaZone(zone);
      if (normalizedZone) params.set("zone", normalizedZone);
      const response = await fetch(`/api/advertisements?${params}`, { signal: abort.signal });
      if (!response.ok) throw new Error("Page unavailable");
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.advertisements) || body.advertisements.length > ADVERTISEMENT_PAGE_SIZE ||
        !body.advertisements.every(isPublicAdvertisement) ||
        (body.nextCursor !== null && (typeof body.nextCursor !== "string" || !parseAdvertisementCursor(body.nextCursor) || body.nextCursor === cursor))) throw new Error("Invalid advertisement page");
      if (abort.signal.aborted) return;
      const page = body as unknown as PublicAdvertisementPage;
      setItems(current => {
        const ids = new Set(current.map(item => item.id));
        return [...current, ...page.advertisements.filter(item => {
          if (ids.has(item.id)) return false;
          ids.add(item.id);
          return true;
        })];
      });
      setCursor(page.nextCursor);
    } catch {
      if (!abort.signal.aborted) setError(true);
    } finally {
      if (!abort.signal.aborted) {
        pending.current = false;
        setLoading(false);
      }
    }
  }, [cursor, zone]);

  const onActiveIndexChange = useCallback((index: number, visibleItems: readonly PublicAdvertisement[] = items) => {
    setActiveIds(current => {
      const next = new Set(current);
      visibleItems.slice(index, index + 4).forEach(item => next.add(item.id));
      return next.size === current.size ? current : next;
    });
    if (!error && index >= visibleItems.length - 4) void loadMore();
  }, [items, error, loadMore]);

  return { items, cursor, loading, error, activeIds, loadMore, onActiveIndexChange };
}
