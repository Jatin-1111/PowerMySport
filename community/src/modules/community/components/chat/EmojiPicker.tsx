"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😜", "🤔", "🤗", "😎", "🥳",
    ],
  },
  {
    name: "Gestures",
    emojis: [
      "👍", "👎", "👊", "✊", "🤞", "✌️", "🤟", "👏", "🙌", "🤝",
      "💪", "🙏", "☝️", "👆", "👋", "🤙",
    ],
  },
  {
    name: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "💥",
      "🔥", "⭐", "✨", "💫", "🎉", "🎊",
    ],
  },
  {
    name: "Sports",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🏸", "🏓", "🏒",
      "🥊", "🏋️", "🤸", "🚴", "🏊", "🏆",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "📱", "💻", "📷", "🎵", "🎮", "📚", "✏️", "📌", "🔔", "💡",
      "⏰", "📅", "✅", "❌", "⚠️", "💬",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍕", "🍔", "🍟", "🌮", "🍩", "🍰", "🍫", "☕", "🧃", "🍎",
      "🥑", "🍗", "🥗", "🍣", "🥤", "🧁",
    ],
  },
];

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  alignRight?: boolean;
};

export default function EmojiPicker({ onSelect, onClose, alignRight }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`absolute bottom-full ${alignRight ? "right-0" : "left-0"} mb-2 z-50 w-[320px] rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden`}
    >
      <div className="max-h-[280px] overflow-y-auto p-2 space-y-2 emoji-picker-scroll">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name}>
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              {category.name}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {category.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-all hover:bg-slate-100 hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
