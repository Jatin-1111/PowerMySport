import { cn } from "@/utils/cn";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import React from "react";

const VARIANTS = {
  primary: {
    button:
      "bg-power-orange-solid text-white hover:bg-orange-800 focus-visible:ring-power-orange-solid",
    circle: "bg-white/15",
  },
  whatsapp: {
    button: "bg-green-700 text-white hover:bg-green-800 focus-visible:ring-green-700",
    circle: "bg-white/15",
  },
  light: {
    button:
      "bg-white text-slate-900 ring-1 ring-slate-900/10 hover:bg-slate-50 focus-visible:ring-slate-900",
    circle: "bg-slate-900/5",
  },
} as const;

/**
 * Pill call-to-action with the trailing arrow nested in its own circle. On hover
 * the circle's arrow travels diagonally; on press the whole button sinks.
 */
export function PillButton({
  href,
  children,
  variant = "primary",
  leading,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  leading?: React.ReactNode;
  className?: string;
}) {
  const external = href.startsWith("http");
  const v = VARIANTS[variant];

  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group inline-flex items-center justify-center gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-medium transition-[background-color,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]",
        v.button,
        className
      )}
    >
      {leading}
      {children}
      <span
        aria-hidden
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105",
          v.circle
        )}
      >
        <ArrowUpRight
          weight="light"
          className="h-4 w-4 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}
