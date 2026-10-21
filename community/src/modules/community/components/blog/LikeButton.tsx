"use client";

import { Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatCount } from "@/modules/community/utils/blogFormat";

interface LikeButtonProps {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { icon: 15, text: "text-xs", pad: "px-2 py-1 gap-1" },
  md: { icon: 18, text: "text-sm", pad: "px-3 py-1.5 gap-1.5" },
  lg: { icon: 20, text: "text-sm", pad: "px-4 py-2 gap-2" },
} as const;

export default function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
  size = "md",
  className = "",
}: LikeButtonProps) {
  const s = SIZES[size];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? "Remove like" : "Like"}
      className={`btn-motion inline-flex items-center rounded-md font-semibold ${s.pad} ${s.text} ${
        liked ? "bg-wash text-indigo-700" : "text-ink-muted hover:bg-paper-deep hover:text-ink"
      } disabled:opacity-50 ${className}`}
    >
      <motion.span
        key={liked ? "on" : "off"}
        initial={{ scale: 0.6 }}
        animate={{ scale: liked ? [1, 1.35, 1] : 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="inline-flex"
      >
        <Heart
          size={s.icon}
          strokeWidth={1.5}
          className={liked ? "fill-power-orange text-power-orange-solid" : ""}
          aria-hidden="true"
        />
      </motion.span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 6, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="tabular-nums"
        >
          {formatCount(count)}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
