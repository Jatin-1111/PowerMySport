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

// One ink arc on a hairline track: progress, not a traffic light.
const RING_COLOR = "#1c1b1a";
const TRACK_COLOR = "#e1dcd3";

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
  const color = RING_COLOR;

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      title={title ?? `Profile ${clamped}% complete`}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TRACK_COLOR}
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
