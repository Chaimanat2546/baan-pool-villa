interface ManualIdsEditorProps {
  errors?: string[];
  manualIdText: string;
  onChange: (value: string) => void;
}

export function formatManualIdEditorText(value: string): string {
  const hasTrailingSeparator = /[\s,;]$/.test(value);
  const formattedValue = value
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .join(",");

  return hasTrailingSeparator && formattedValue
    ? `${formattedValue},`
    : formattedValue;
}

export function ManualIdsEditor({
  errors = [],
  manualIdText,
  onChange,
}: ManualIdsEditorProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--site-text)]">
            บ้านพักในชุดนี้
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-[var(--site-muted)]">
            พิมพ์เลขบ้านที่อยากโชว์ เช่น 105,101,111
          </p>
        </div>
        <textarea
          aria-describedby={
            errors.length > 0 ? "admin-section-manual-ids-error" : undefined
          }
          aria-invalid={errors.length > 0}
          className={`min-h-36 w-full rounded-md border bg-[var(--site-surface)] px-3 py-2 font-mono text-sm text-[var(--site-text)] outline-none transition ${
            errors.length > 0
              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              : "border-[var(--site-border)] focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          }`}
          onChange={(event) => {
            onChange(formatManualIdEditorText(event.target.value));
          }}
          placeholder="105,101,111"
          value={manualIdText}
        />
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
    </div>
  );
}
