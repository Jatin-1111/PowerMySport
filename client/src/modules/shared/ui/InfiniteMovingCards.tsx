"use client";

import { cn } from "@/utils/cn";
import React, { useEffect, useState } from "react";

export interface MovingCardItem {
  quote: string;
  name: string;
  title: string;
}

interface InfiniteMovingCardsProps {
  items: MovingCardItem[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}

/**
 * Seamless looping marquee of quote cards.
 * Adapted from Aceternity UI's Infinite Moving Cards, restyled to the PowerMySport theme.
 */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
}: InfiniteMovingCardsProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    if (containerRef.current && scrollerRef.current) {
      const scrollerContent = Array.from(scrollerRef.current.children);
      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true);
        scrollerRef.current?.appendChild(duplicatedItem);
      });

      containerRef.current.style.setProperty(
        "--animation-direction",
        direction === "left" ? "forwards" : "reverse",
      );
      containerRef.current.style.setProperty(
        "--animation-duration",
        speed === "fast" ? "20s" : speed === "normal" ? "40s" : "80s",
      );
      setStart(true);
    }
  }, [direction, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-10 max-w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_10%,white_90%,transparent)]",
        className,
      )}
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-2",
          start && "animate-scroll",
          pauseOnHover && "hover:[animation-play-state:paused]",
        )}
      >
        {items.map((item, idx) => (
          <li
            key={item.name + idx}
            className="relative w-[320px] max-w-full shrink-0 rounded-2xl border border-white/70 bg-white/80 px-6 py-5 shadow-sm backdrop-blur-md premium-shadow md:w-[400px]"
          >
            <blockquote>
              <p className="text-sm leading-relaxed text-slate-700">
                &ldquo;{item.quote}&rdquo;
              </p>
              <footer className="mt-4 flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-power-orange to-amber-500 text-xs font-bold text-white">
                  {item.name.charAt(0)}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">{item.name}</span>
                  <span className="text-xs text-slate-500">{item.title}</span>
                </span>
              </footer>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
}
