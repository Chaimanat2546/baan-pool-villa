import { Eye } from "lucide-react";

type ManualIdsEditorProps = {
  isPreviewing: boolean;
  manualIdText: string;
  onChange: (value: string) => void;
  onPreview: () => void;
};

export function ManualIdsEditor({
  isPreviewing,
  manualIdText,
  onChange,
  onPreview,
}: ManualIdsEditorProps) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-[#dbe6e1] bg-[#f8fbf9] p-4">
      <div className="grid gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#173f36]">
            บ้านพักในชุดนี้
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-[#58726a]">
            พิมพ์เลขบ้านที่อยากโชว์ เช่น 105 101 111
          </p>
        </div>
        <textarea
          className="min-h-40 w-full rounded-[18px] border border-[#c9d9d3] bg-white px-3 py-2 font-mono text-sm text-[#063f35] outline-none transition focus:border-[#0f5a66] focus:ring-2 focus:ring-[#0f5a66]/15"
          onChange={(event) => onChange(event.target.value)}
          placeholder="105 101 111"
          value={manualIdText}
        />
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#b7cbc3] bg-white px-3 text-sm font-semibold text-[#17463c] transition hover:bg-[#f6faf8] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPreviewing}
          onClick={onPreview}
          type="button"
        >
          <Eye aria-hidden="true" className="size-4" />
          {isPreviewing ? "กำลังเช็กบ้าน..." : "เช็กอีกครั้ง"}
        </button>
        <p className="text-center text-xs leading-5 text-[#58726a]">
          เช็กให้อัตโนมัติหลังหยุดพิมพ์
        </p>
      </div>
    </div>
  );
}
