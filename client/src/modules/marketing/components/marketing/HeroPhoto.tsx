"use client";

import { cn } from "@/utils/cn";
import Image from "next/image";
import { useState, useSyncExternalStore } from "react";

interface HeroPhotoOption {
  label: string;
  src: string;
  alt: string;
  position: string;
}

const UNSPLASH = "?fm=jpg&q=75&w=2400&auto=format&fit=crop";

// The first is what the page shows. The others are there for choosing between
// photographs: open the homepage with `?compare=photos` for a switch that shows
// them one at a time.
const OPTIONS: HeroPhotoOption[] = [
  {
    label: "Current",
    src: `https://images.unsplash.com/photo-1605550498663-f270981a3cf8${UNSPLASH}`,
    alt: "A smiling young boy in a blue kit about to kick a football on a turf ground",
    position: "object-top",
  },
  {
    label: "Photo 2",
    src: `https://images.unsplash.com/photo-1612542795178-ef13feed5ddd${UNSPLASH}`,
    alt: "Boys playing together on a grass field",
    position: "object-center",
  },
  {
    label: "Photo 3",
    src: `https://images.unsplash.com/photo-1620700374542-d129058c0d0a${UNSPLASH}`,
    alt: "Children playing together in a lane",
    position: "object-center",
  },
];

const noop = () => () => {};
const wantsCompare = () => new URLSearchParams(window.location.search).get("compare") === "photos";

/** The photograph in the homepage hero, with a review switch when `?compare=photos` is in the address. */
export function HeroPhoto() {
  const compare = useSyncExternalStore(noop, wantsCompare, () => false);
  const [index, setIndex] = useState(0);
  const current = OPTIONS[index] ?? OPTIONS[0]!;

  return (
    <>
      <Image
        key={current.src}
        src={current.src}
        alt={current.alt}
        fill
        priority
        sizes="(min-width: 1280px) 1216px, 100vw"
        className={cn("object-cover saturate-[0.9]", current.position)}
      />
      {compare && (
        <div
          role="group"
          aria-label="Compare photographs"
          className="bg-paper border-ink absolute right-3 top-3 z-10 flex overflow-hidden rounded-md border shadow-lg"
        >
          {OPTIONS.map((option, i) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700",
                i === index ? "bg-ink text-paper" : "text-ink hover:bg-paper-deep"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
