interface ManualIdsEditorProps {
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
          className="min-h-36 w-full rounded-md border border-[var(--site-border)] bg-[var(--site-surface)] px-3 py-2 font-mono text-sm text-[var(--site-text)] outline-none transition focus:border-[var(--site-primary)] focus:ring-2 focus:ring-[var(--site-primary)]/15"
          onChange={(event) => {
            onChange(formatManualIdEditorText(event.target.value));
          }}
          placeholder="105,101,111"
          value={manualIdText}
        />
        <p className="text-xs leading-5 text-[var(--site-muted)]">
          ระบบจะเช็กเลขบ้านให้อัตโนมัติและตรวจอีกครั้งตอนกดบันทึก
        </p>
      </div>
    </div>
  );
}
