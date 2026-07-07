"use client";

import {
    // P5-P9 icons
    Heart,
} from "lucide-react";

import {
    SavedItem
} from '../utils';

// ─── P5: Save Button ──────────────────────────────────────────────────────────

export function SaveButton({
  item,
  type,
  sport,
  savedItems,
  onToggle,
}: {
  item: any;
  type: SavedItem["type"];
  sport: string;
  savedItems: SavedItem[];
  onToggle: (items: SavedItem[]) => void;
}) {
  const id = `${type}:${item.name || item.role}:${sport}`;
  const isSaved = savedItems.some((s) => s.id === id);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    let updated: SavedItem[];
    if (isSaved) {
      updated = savedItems.filter((s) => s.id !== id);
    } else {
      updated = [
        ...savedItems,
        {
          id,
          type,
          name: item.name || item.role,
          sport,
          data: item,
          savedAt: new Date().toISOString(),
        },
      ];
    }
    onToggle(updated);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isSaved ? "Remove from saved" : "Save for later"}
      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all shrink-0 ${
        isSaved
          ? "border-rose-200 bg-rose-50 text-rose-500 shadow-sm"
          : "border-slate-200 bg-white/80 text-slate-300 hover:border-rose-200 hover:text-rose-400"
      }`}
    >
      <Heart className={`h-3.5 w-3.5 ${isSaved ? "fill-rose-500" : ""}`} />
    </button>
  );
}

