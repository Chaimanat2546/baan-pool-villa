import { MessageCircle } from "lucide-react";

export function LineIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-lg bg-[#06c755] text-[8px] font-black leading-none text-white shadow-sm ${className}`}
    >
      LINE
    </span>
  );
}

export function MessengerIcon({ className = "" }: { className?: string }) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full bg-[#0a7cff] text-white shadow-sm ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
    </span>
  );
}
