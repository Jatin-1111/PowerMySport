"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🤩",
  "😎",
  "🥳",
  "🤔",
  "😅",
  "👍",
  "👏",
  "🙌",
  "💪",
  "🔥",
  "⚡",
  "✨",
  "🎯",
  "🏆",
  "🥇",
  "⚽",
  "🏀",
  "🏏",
  "🏸",
  "🎾",
  "🏑",
  "❤️",
  "🧡",
  "💯",
  "🙏",
  "😢",
  "😮",
  "🎉",
  "👀",
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

/** Lightweight dependency-free emoji popover for the comment composer. */
export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="Add emoji"
      >
        <Smile size={18} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
          >
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
