import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  children: ReactNode;
}

export function ChunkyButton({ variant = "primary", className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "shiny-btn group relative inline-flex items-center justify-center gap-2 rounded-2xl font-display tracking-wide transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70",
        "active:scale-95",
        variant === "primary" &&
          "bg-gradient-to-b from-lime-300 to-emerald-500 px-8 py-4 text-lg text-emerald-950 shadow-[0_10px_30px_-8px_rgba(163,230,53,0.7),inset_0_2px_0_rgba(255,255,255,0.5)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(163,230,53,0.8),inset_0_2px_0_rgba(255,255,255,0.5)]",
        variant === "ghost" &&
          "panel-glass px-6 py-3.5 text-sm text-emerald-100 hover:bg-emerald-400/10 hover:text-lime-200",
        variant === "danger" &&
          "bg-gradient-to-b from-rose-400 to-red-600 px-8 py-4 text-lg text-rose-50 shadow-[0_10px_30px_-8px_rgba(248,113,113,0.7)] hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={cn(
        "panel-glass inline-flex h-10 w-10 items-center justify-center rounded-xl text-emerald-200 transition-all duration-150",
        "hover:bg-emerald-400/15 hover:text-lime-300 active:scale-90",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70",
        className
      )}
    >
      {children}
    </button>
  );
}

export function StaggerText({
  text,
  className,
  baseDelay = 0,
  step = 60,
}: {
  text: string;
  className?: string;
  baseDelay?: number;
  step?: number;
}) {
  return (
    <span className={className} role="heading" aria-level={1} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block animate-letter-in"
          style={{ animationDelay: `${baseDelay + i * step}ms` }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}
