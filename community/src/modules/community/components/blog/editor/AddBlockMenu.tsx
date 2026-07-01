"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Heading,
  Image as ImageIcon,
  List,
  Plus,
  Quote,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BlogBlockType } from "@/modules/community/types";

const OPTIONS: Array<{ type: BlogBlockType; label: string; Icon: LucideIcon }> = [
  { type: "text", label: "Text", Icon: Type },
  { type: "heading", label: "Heading", Icon: Heading },
  { type: "list", label: "List", Icon: List },
  { type: "quote", label: "Quote", Icon: Quote },
  { type: "image", label: "Image", Icon: ImageIcon },
];

interface AddBlockMenuProps {
  onAdd: (type: BlogBlockType) => void;
}

export default function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-power-orange/40 hover:text-power-orange"
        aria-label="Add block"
      >
        <Plus size={16} className={open ? "rotate-45 transition-transform" : "transition-transform"} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-[calc(100%+6px)] z-30 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
          >
            {OPTIONS.map(({ type, label, Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onAdd(type);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Icon size={15} />
                </span>
                {label}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
