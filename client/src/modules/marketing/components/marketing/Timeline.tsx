"use client";

import { cn } from "@/utils/cn";
import { motion, useScroll, useTransform } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

export interface TimelineEntry {
  title: React.ReactNode;
  content: React.ReactNode;
}

interface TimelineProps {
  data: TimelineEntry[];
  className?: string;
}

/**
 * Sticky-header timeline with a scroll-tracking gradient beam.
 * Adapted from Aceternity UI's Timeline, restyled to the PowerMySport theme.
 */
export function Timeline({ data, className }: TimelineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref, data]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 15%", "end 60%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div ref={ref} className="relative mx-auto max-w-6xl">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex justify-start gap-6 pt-10 first:pt-0 md:gap-10 md:pt-24"
          >
            {/* Sticky rail: dot + step title */}
            <div className="sticky top-32 z-30 flex max-w-[6rem] shrink-0 flex-col items-center self-start md:max-w-xs md:flex-row md:items-start">
              <div className="absolute left-3 flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white shadow-sm md:left-0">
                <div className="h-3 w-3 rounded-full bg-power-orange" />
              </div>
              <h3 className="hidden pl-16 text-xl font-bold text-slate-300 md:block md:text-3xl lg:text-4xl">
                {item.title}
              </h3>
            </div>

            {/* Content */}
            <div className="relative w-full pl-16 pr-2 md:pl-4">
              <h3 className="mb-4 block text-2xl font-bold text-slate-300 md:hidden">
                {item.title}
              </h3>
              {item.content}
            </div>
          </div>
        ))}

        {/* Track + animated beam */}
        <div
          style={{ height: height + "px" }}
          className="absolute left-[1.6rem] top-0 w-[2px] overflow-hidden bg-gradient-to-b from-transparent from-[0%] via-slate-200 to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)] md:left-[1.1rem]"
        >
          <motion.div
            style={{ height: heightTransform, opacity: opacityTransform }}
            className="absolute inset-x-0 top-0 w-[2px] rounded-full bg-gradient-to-t from-power-orange via-amber-400 to-transparent from-[0%] via-[10%]"
          />
        </div>
      </div>
    </div>
  );
}
