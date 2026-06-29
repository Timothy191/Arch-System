import { cn } from "../lib/utils";

interface AgenticAiLogoProps {
  className?: string;
}

/** Compact mark for Agentic AI System branding on auth surfaces. */
export function AgenticAiLogo({ className }: AgenticAiLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <circle cx="8" cy="3.25" r="2" fill="currentColor" />
      <circle cx="3.25" cy="12.75" r="2" fill="currentColor" opacity="0.75" />
      <circle cx="12.75" cy="12.75" r="2" fill="currentColor" opacity="0.75" />
      <path
        d="M8 5.25 3.75 10.75M8 5.25l4.25 5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M11.5 2.5 12.75 1.25 14 2.5 12.75 3.75Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
