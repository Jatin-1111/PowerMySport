"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  CopyPlus,
  GripVertical,
  Heading,
  Image as ImageIcon,
  List,
  Quote,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BlogBlockType } from "@/modules/community/types";

interface BlockActionsMenuProps {
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onChangeType: (type: BlogBlockType) => void;
  /** Starts drag-to-reorder — the six-dot grip doubles as the drag handle. */
  onDragPointerDown?: (event: React.PointerEvent) => void;
}

const TURN_INTO: Array<{ type: BlogBlockType; label: string; Icon: LucideIcon }> = [
  { type: "text", label: "Text", Icon: Type },
  { type: "heading", label: "Heading", Icon: Heading },
  { type: "list", label: "List", Icon: List },
  { type: "quote", label: "Quote", Icon: Quote },
  { type: "image", label: "Image", Icon: ImageIcon },
];

export default function BlockActionsMenu({
  onDuplicate,
  onCopy,
  onDelete,
  onChangeType,
  onDragPointerDown,
}: BlockActionsMenuProps) {
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

  const actions = [
    { label: "Duplicate", Icon: CopyPlus, action: onDuplicate, danger: false },
    { label: "Copy text", Icon: Copy, action: onCopy, danger: false },
    { label: "Delete", Icon: Trash2, action: onDelete, danger: true },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onPointerDown={onDragPointerDown}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 active:cursor-grabbing"
        aria-label="Block actions, change type, and drag to reorder"
        title="Drag to reorder · click for actions"
      >
        <GripVertical size={15} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-[calc(100%+6px)] z-30 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Turn into
            </p>
            {TURN_INTO.map(({ type, label, Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onChangeType(type);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Icon size={13} />
                </span>
                {label}
              </button>
            ))}

            <div className="my-1 h-px bg-slate-100" />

            {actions.map(({ label, Icon, action, danger }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  action();
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${
                  danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
