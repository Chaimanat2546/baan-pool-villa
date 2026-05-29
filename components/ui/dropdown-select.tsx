"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface DropdownSelectOption<TValue extends string = string> {
  label: string;
  value: TValue;
}

interface DropdownSelectProps<TValue extends string = string> {
  ariaLabel?: string;
  buttonClassName?: string;
  className?: string;
  menuClassName?: string;
  onChange: (value: TValue) => void;
  options: DropdownSelectOption<TValue>[];
  placeholder?: string;
  value: TValue;
}

export function DropdownSelect<TValue extends string = string>({
  ariaLabel,
  buttonClassName,
  className,
  menuClassName,
  onChange,
  options,
  placeholder = "เลือกรายการ",
  value,
}: DropdownSelectProps<TValue>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(nextValue: TValue) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={isOpen ? menuId : undefined}
        className={cn(
          "mt-2 flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--site-border)] bg-[var(--site-surface-soft)] px-3 text-left text-sm font-bold text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--site-accent)] focus:ring-offset-2",
          buttonClassName,
        )}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-[var(--site-text)] transition",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute left-0 right-0 top-[3.75rem] z-30 rounded-2xl border border-[var(--site-border)] bg-[var(--site-surface)] p-3 shadow-[0_18px_54px_rgba(6,63,53,0.16)]",
            menuClassName,
          )}
        >
          <div className="grid max-h-72 gap-1 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className="flex h-11 items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-medium text-[var(--site-text)] transition hover:bg-[var(--site-primary-soft)]"
                  onClick={() => {
                    handleSelect(option.value);
                  }}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {isSelected ? <Check className="h-4 w-4 text-[var(--site-accent)]" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
