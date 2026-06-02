import { FaFacebookMessenger, FaLine } from "react-icons/fa";

interface ContactIconProps {
  className?: string;
}

export function FacebookIcon({ className = "" }: ContactIconProps) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full bg-[#1877f2] text-white shadow-sm ${className}`}
    >
      <FaFacebookMessenger aria-hidden="true" className="h-[58%] w-[58%]" />
    </span>
  );
}

export function LineIcon({ className = "" }: ContactIconProps) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-full bg-[#06c755] text-white shadow-sm ${className}`}
    >
      <FaLine aria-hidden="true" className="h-[62%] w-[62%]" />
    </span>
  );
}

export function MessengerIcon(props: ContactIconProps) {
  return <FacebookIcon {...props} />;
}
