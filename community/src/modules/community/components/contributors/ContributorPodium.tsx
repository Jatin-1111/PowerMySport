"use client";

import { motion } from "framer-motion";
import { Crown, Star, User } from "lucide-react";
import { LeaderboardItem } from "./types";

const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd" };

const PODIUM_STYLES: Record<
  number,
  { height: string; bar: string; ring: string; glow: string }
> = {
  1: {
    height: "h-52 sm:h-72",
    bar: "bg-gradient-to-b from-[#FDF3DC] to-[#F9E2A7]",
    ring: "ring-[#F0D999]",
    glow: "bg-amber-200/40",
  },
  2: {
    height: "h-40 sm:h-56",
    bar: "bg-gradient-to-b from-[#EFEDF8] to-[#D9D4EE]",
    ring: "ring-[#CFC9EA]",
    glow: "bg-violet-200/30",
  },
  3: {
    height: "h-32 sm:h-44",
    bar: "bg-gradient-to-b from-[#F7E7E5] to-[#EBCBC7]",
    ring: "ring-[#E4BFBB]",
    glow: "bg-rose-200/30",
  },
};

function PodiumSlot({ item }: { item: LeaderboardItem }) {
  const style = PODIUM_STYLES[item.rank] || PODIUM_STYLES[3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: item.rank * 0.1,
      }}
      className="flex w-20 flex-col items-center sm:w-24"
    >
      <div className="relative mb-2">
        {item.rank === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -6, rotate: -8, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, rotate: -8, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.35, type: "spring" }}
            className="absolute -left-2 -top-4 text-amber-400"
          >
            <Crown size={18} fill="currentColor" />
          </motion.div>
        )}
        <motion.div
          whileHover={{ scale: 1.08 }}
          className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-2 sm:h-12 sm:w-12 ${style.ring}`}
        >
          {item.photoUrl ? (
            <img
              src={item.photoUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-slate-400 sm:text-base">
              {item.name.charAt(0).toUpperCase()}
            </span>
          )}
        </motion.div>
      </div>
      <p className="max-w-full truncate text-center text-xs font-semibold text-slate-800 sm:text-sm">
        {item.name}
      </p>

      <motion.div
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{
          duration: 0.55,
          delay: 0.2 + item.rank * 0.1,
          ease: "easeOut",
        }}
        style={{ transformOrigin: "bottom" }}
        className={`relative mt-2 flex w-full flex-col items-center justify-end gap-2 overflow-hidden rounded-t-xl pb-4 shadow-md ${style.bar} ${style.height}`}
      >
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
          {ORDINALS[item.rank] || `#${item.rank}`}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm">
          <Star size={11} className="text-amber-500" fill="currentColor" />
          {item.score} pts
        </span>
      </motion.div>
    </motion.div>
  );
}

export function ContributorPodium({ items }: { items: LeaderboardItem[] }) {
  const top = items.slice(0, 3);

  if (top.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 py-10 text-center">
        <User size={26} className="text-slate-300" />
        <p className="text-sm font-medium text-slate-500">
          No contributors yet — be the first to earn points.
        </p>
      </div>
    );
  }

  // 3 people: classic podium arrangement (2nd, 1st, 3rd).
  // Fewer than 3: plain left-to-right rank order (1st, then 2nd).
  const visualOrder = top.length === 3 ? [top[1], top[0], top[2]] : top;

  return (
    <div className="relative mx-auto flex max-w-[280px] items-end justify-center gap-3 px-2 py-8 sm:max-w-sm sm:gap-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle_at_50%_65%,rgba(251,191,36,0.14),transparent_65%)]"
      />
      {visualOrder.map((item) => (
        <PodiumSlot key={item.id} item={item} />
      ))}
    </div>
  );
}
