"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ManualHouseOption = {
  coverImage?: string | null;
  id: string;
  title: string;
};

interface ManualIdsEditorProps {
  errors?: string[];
  houses: ManualHouseOption[];
  onChange: (houseIds: string[]) => void;
  onSearch: (query: string, selectedHouseIds: string[]) => void;
  selectedHouseIds: string[];
}

export function ManualIdsEditor({
  errors = [],
  houses,
  onChange,
  onSearch,
  selectedHouseIds,
}: ManualIdsEditorProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const housesById = useMemo(
    () => new Map(houses.map((house) => [house.id, house])),
    [houses],
  );
  const selectedHouseIdsKey = selectedHouseIds.join(",");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const suggestions = houses.filter(
    (house) =>
      normalizedQuery.length > 0 &&
      !selectedHouseIds.includes(house.id) &&
      `${house.title} ${house.id}`.toLocaleLowerCase().includes(normalizedQuery),
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onSearch(
        query,
        query.trim() ? [] : selectedHouseIdsKey.split(",").filter(Boolean),
      );
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [onSearch, query, selectedHouseIdsKey]);

  function selectHouse(house: ManualHouseOption) {
    onChange([...selectedHouseIds, house.id]);
    setQuery("");
    setActiveIndex(0);
  }

  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--site-text)]">
          บ้านพักในชุดนี้
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
          พิมพ์ชื่อหรือเลขบ้าน แล้วเลือกจากรายการ
        </p>
      </div>
      <div
        className={`rounded-md border bg-[var(--site-surface)] p-2 transition ${
          errors.length > 0
            ? "border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20"
            : "border-[var(--site-border)] focus-within:border-[var(--site-primary)] focus-within:ring-2 focus-within:ring-[var(--site-primary)]/15"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {selectedHouseIds.map((houseId) => {
            const house = housesById.get(houseId);
            const label = house?.title ?? `บ้าน ${houseId}`;

            return (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--site-primary-soft)] px-2.5 py-1 text-sm font-medium text-[var(--site-primary)]"
                data-manual-house-chip={houseId}
                key={houseId}
              >
                <span className="truncate">{label}</span>
                <span className="text-xs opacity-75">{houseId}</span>
                <button
                  aria-label={`ลบบ้าน ${label}`}
                  className="rounded-full p-0.5 hover:bg-[var(--site-primary)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--site-primary)]"
                  onClick={() => {
                    onChange(selectedHouseIds.filter((id) => id !== houseId));
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            );
          })}
          <input
            aria-controls="admin-section-manual-house-options"
            aria-describedby={
              errors.length > 0 ? "admin-section-manual-ids-error" : undefined
            }
            aria-expanded={suggestions.length > 0}
            aria-invalid={errors.length > 0}
            aria-label="ค้นหาบ้านพัก"
            className="min-w-40 flex-1 bg-transparent px-1 py-1 text-sm text-[var(--site-text)] outline-none placeholder:text-[var(--site-muted)]"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (
                suggestions[activeIndex] &&
                ["Enter", "Tab", ",", " "].includes(event.key)
              ) {
                event.preventDefault();
                selectHouse(suggestions[activeIndex]);
              } else if (
                event.key === "Backspace" &&
                !query &&
                selectedHouseIds.length > 0
              ) {
                onChange(selectedHouseIds.slice(0, -1));
              }
            }}
            placeholder="ค้นหาชื่อหรือเลขบ้าน"
            role="combobox"
            value={query}
          />
        </div>
        {suggestions.length > 0 ? (
          <ul
            className="mt-2 max-h-56 overflow-y-auto rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-1 shadow-lg"
            id="admin-section-manual-house-options"
            role="listbox"
          >
            {suggestions.map((house, index) => (
              <li key={house.id} role="option" aria-selected={index === activeIndex}>
                <button
                  className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm transition ${
                    index === activeIndex
                      ? "bg-[var(--site-primary-soft)] text-[var(--site-primary)]"
                      : "text-[var(--site-text)] hover:bg-[var(--site-surface-soft)]"
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectHouse(house)}
                  type="button"
                >
                  <span className="truncate font-medium">{house.title}</span>
                  <span className="shrink-0 text-xs text-[var(--site-muted)]">
                    {house.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {errors.length > 0 ? (
        <ul
          className="list-disc space-y-1 pl-5 text-xs font-semibold leading-5 text-red-700"
          data-admin-section-field-error="manualIds"
          id="admin-section-manual-ids-error"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
