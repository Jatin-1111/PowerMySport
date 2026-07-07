"use client";

import { cn } from "@/utils/cn";
import { ReactNode } from "react";

interface ProfileCompletionRingProps {
  /** 0-100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** Rendered centered inside the ring — e.g. an icon or avatar. */
  children?: ReactNode;
  /** Show the numeric percentage in the center when no children are passed. */
  showLabel?: boolean;
  className?: string;
  title?: string;
}

function ringColor(percent: number): string {
  if (percent >= 100) return "#22C55E"; // emerald-500 — complete
  if (percent >= 50) return "#E97316"; // power-orange — good progress
  return "#F59E0B"; // amber-500 — needs attention
}

export function ProfileCompletionRing({
  percent,
  size = 44,
  strokeWidth = 3,
  children,
  showLabel = false,
  className,
  title,
}: ProfileCompletionRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = ringColor(clamped);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      title={title ?? `Profile ${clamped}% complete`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="relative z-10 flex items-center justify-center">
        {children ??
          (showLabel && (
            <span className="text-[10px] font-bold" style={{ color }}>
              {clamped}%
            </span>
          ))}
      </div>
    </div>
  );
}
