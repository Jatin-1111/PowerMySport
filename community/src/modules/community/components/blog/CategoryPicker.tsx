"use client";

import { EXPERIENCE_CATEGORIES } from "@/modules/community/constants/experienceTaxonomy";

interface CategoryPickerProps {
  onSelect: (categorySlug: string) => void;
}

/**
 * The composer's first screen. Not a blank page and not a title field: a
 * question. This is the single biggest lever on "write a story sounds like
 * homework": picking a category hands the editor a real prompt instead of a
 * blinking cursor.
 */
export default function CategoryPicker({ onSelect }: CategoryPickerProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-3xl flex-col justify-center px-4 py-12 sm:px-6">
      <h1 className="font-editorial text-ink text-balance text-5xl font-light leading-[1.05] sm:text-6xl">
        What is this about?
      </h1>
      <p className="text-ink-body mt-4 max-w-[48ch] text-lg leading-relaxed">
        Pick the closest one. Two lines is plenty, and we will give you a question to start from.
      </p>

      <ul className="border-hairline mt-10 grid grid-cols-1 border-t sm:grid-cols-2 sm:gap-x-10">
        {EXPERIENCE_CATEGORIES.map((category) => (
          <li key={category.slug} className="border-hairline border-b">
            <button
              type="button"
              onClick={() => onSelect(category.slug)}
              className="hover:bg-paper-deep/60 group -mx-3 flex min-h-14 w-[calc(100%+1.5rem)] items-center gap-4 px-3 py-4 text-left transition-colors duration-200"
            >
              <category.Icon
                size={20}
                strokeWidth={1.5}
                className="text-ink shrink-0"
                aria-hidden="true"
              />
              <span className="font-editorial text-ink decoration-ink/30 text-xl font-normal underline-offset-4 group-hover:underline">
                {category.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
