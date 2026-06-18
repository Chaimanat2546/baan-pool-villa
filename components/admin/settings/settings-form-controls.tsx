import type { ReactNode } from "react";

import { isHexColor } from "./settings-helpers";

interface ColorControlProps {
  description?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}

interface TextControlProps {
  description?: string;
  id: string;
  inputMode?:
    | "decimal"
    | "email"
    | "numeric"
    | "search"
    | "tel"
    | "text"
    | "url";
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}

interface SectionCardProps {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  id: string;
  title: string;
}

export function ColorControl({
  description,
  id,
  label,
  onChange,
  value,
}: ColorControlProps) {
  const trimmedValue = value.trim();
  const colorPickerValue = isHexColor(trimmedValue) ? trimmedValue : "#000000";

  return (
    <div className="grid gap-2">
      <div className="space-y-1">
        <label
          className="text-sm font-semibold text-[var(--site-text)]"
          htmlFor={id}
        >
          {label}
        </label>
        {description ? (
          <p className="text-xs leading-5 text-[var(--site-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-[52px_1fr] gap-3">
        <input
          aria-label={`${label} ตัวเลือกสี`}
          className="h-11 w-[52px] rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] p-1"
          onChange={(event) => {
            onChange(event.target.value.trim());
          }}
          type="color"
          value={colorPickerValue}
        />
        <input
          className="h-11 min-w-0 rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 font-mono text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          id={id}
          onChange={(event) => {
            onChange(event.target.value.trim());
          }}
          placeholder="#064e3b"
          value={trimmedValue}
        />
      </div>
    </div>
  );
}

export function TextControl({
  description,
  id,
  inputMode,
  label,
  maxLength,
  multiline = false,
  onChange,
  placeholder,
  rows = 3,
  value,
}: TextControlProps) {
  return (
    <label
      className="block text-sm font-semibold text-[var(--site-text)]"
      htmlFor={id}
    >
      <span>{label}</span>
      {description ? (
        <span className="mt-1 block text-xs font-medium leading-5 text-[var(--site-muted)]">
          {description}
        </span>
      ) : null}
      {multiline ? (
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 text-sm font-medium text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          id={id}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      ) : (
        <input
          className="mt-2 h-11 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 text-sm font-medium text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          id={id}
          inputMode={inputMode}
          maxLength={maxLength}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          value={value}
        />
      )}
    </label>
  );
}

export function SectionCard({
  children,
  description,
  icon,
  id,
  title,
}: SectionCardProps) {
  return (
    <section
      className="scroll-mt-32 rounded-lg border border-[var(--site-border)] bg-[var(--site-surface)] p-5 shadow-sm"
      id={id}
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--site-primary-soft)] text-[var(--site-primary)]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[var(--site-text)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--site-muted)]">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}
