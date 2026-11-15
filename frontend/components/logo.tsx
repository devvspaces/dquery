import { useId } from "react";
import { cn } from "@/lib/utils";

/** DQuery mark: a "Q" magnifier around the domain dot. Same art as app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("h-7 w-7 shrink-0", className)}
      role="img"
      aria-label="DQuery"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#19c2a0" />
          <stop offset="1" stopColor="#0b7a66" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gradientId})`} />
      <circle cx="234" cy="234" r="118" fill="none" stroke="#fff" strokeWidth="54" />
      <path d="M318 318 L398 398" stroke="#fff" strokeWidth="58" strokeLinecap="round" />
      <circle cx="234" cy="234" r="36" fill="#fff" />
    </svg>
  );
}
