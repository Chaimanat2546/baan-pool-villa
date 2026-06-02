import { Eye, Save } from "lucide-react";
import Link from "next/link";

interface ManualIdsEditorProps {
  isPreviewing: boolean;
  manualIdText: string;
  onChange: (value: string) => void;
  onPreview: () => void;
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
  isPreviewing,
  manualIdText,
  onChange,
  onPreview,
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
        <div className=" flex flex-row w-full items-center justify-end gap-2">
          <button
            className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPreviewing}
            onClick={onPreview}
            type="button"
          >
            <Save aria-hidden="true" className="size-4" />
            {isPreviewing ? "กำลังเช็กบ้าน..." : "เช็กอีกครั้ง"}
          </button>
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--site-border-strong)] bg-[var(--site-surface)] px-3 text-sm font-semibold text-[var(--site-primary)] transition hover:bg-[var(--site-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Eye aria-hidden="true" className="size-4" />
            พรีวิว
          </Link>
        </div>

        <p className="text-center text-xs leading-5 text-[var(--site-muted)]">
          เช็กให้อัตโนมัติหลังหยุดพิมพ์
        </p>
      </div>
    </div>
  );
}
