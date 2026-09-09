"use client";

import { motion } from "framer-motion";
import { EXPERIENCE_CATEGORIES } from "@/modules/community/constants/experienceTaxonomy";

interface CategoryPickerProps {
  onSelect: (categorySlug: string) => void;
}

/**
 * The composer's first screen. Not a blank page and not a title field — a
 * question. This is the single biggest lever on "write a story sounds like
 * homework": picking a category hands the editor a real prompt instead of a
 * blinking cursor.
 */
export default function CategoryPicker({ onSelect }: CategoryPickerProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <h1 className="font-title text-2xl font-bold text-slate-900 sm:text-3xl">
          What&apos;s this about?
        </h1>
        <p className="mt-2 text-sm text-slate-500">Pick the closest one — two lines is plenty.</p>
      </motion.div>

      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {EXPERIENCE_CATEGORIES.map((category, index) => (
          <motion.button
            key={category.slug}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.02 }}
            onClick={() => onSelect(category.slug)}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition hover:-translate-y-0.5 hover:shadow-md ${category.accent}`}
          >
            <category.Icon size={20} />
            <span className="text-xs font-semibold leading-tight">{category.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
