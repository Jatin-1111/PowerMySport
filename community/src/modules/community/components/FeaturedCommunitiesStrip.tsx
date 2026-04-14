"use client";

import { CommunityGroupSummary } from "@/modules/community/types";
import { motion, useReducedMotion } from "framer-motion";

type FeaturedCommunitiesStripProps = {
  groups: CommunityGroupSummary[];
  getActionLabel: (group: CommunityGroupSummary) => string;
  onGroupAction: (group: CommunityGroupSummary) => void;
  onViewAll: () => void;
  isGroupFollowed?: (groupId: string) => boolean;
  onToggleGroupFollow?: (group: CommunityGroupSummary) => void;
};

export function FeaturedCommunitiesStrip({
  groups,
  getActionLabel,
  onGroupAction,
  onViewAll,
  isGroupFollowed,
  onToggleGroupFollow,
}: FeaturedCommunitiesStripProps) {
  const prefersReducedMotion = useReducedMotion();
  const listStagger = prefersReducedMotion
    ? { duration: 0.01 }
    : { staggerChildren: 0.07, delayChildren: 0.06 };

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-4 shadow-sm backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Explore communities
          </p>
          <h3 className="font-title mt-1 text-sm font-semibold text-slate-900 sm:text-base">
            Popular groups near players like you
          </h3>
        </div>
        <motion.button
          onClick={onViewAll}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -1 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          className="rounded-xl border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
        >
          View all
        </motion.button>
      </div>

      {groups.length ? (
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={{
            hidden: {},
            show: { transition: listStagger },
          }}
          className="mt-4 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3"
        >
          {groups.map((group) => {
            const actionLabel = getActionLabel(group);
            return (
              <motion.article
                key={group.id}
                variants={{
                  hidden: { opacity: 0, y: 18 },
                  show: { opacity: 1, y: 0 },
                }}
                whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="min-w-60 rounded-[1.35rem] border border-slate-200 bg-white/90 p-3 shadow-sm sm:min-w-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-title line-clamp-1 text-sm font-semibold text-slate-900">
                    {group.name}
                  </p>
                  {group.isMember && (
                    <span className="rounded-full bg-turf-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-turf-green">
                      Joined
                    </span>
                  )}
                </div>
                {(group.sport || group.city) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {[group.sport, group.city].filter(Boolean).join(" • ")}
                  </p>
                )}
                <p className="mt-3 text-xs font-medium text-slate-500">
                  {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                </p>
                <motion.button
                  onClick={() => onGroupAction(group)}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    !group.isMember
                      ? "bg-power-orange text-white hover:opacity-90"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {actionLabel}
                </motion.button>
                {onToggleGroupFollow && (
                  <button
                    onClick={() => onToggleGroupFollow(group)}
                    className={`mt-2 w-full rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
                      isGroupFollowed?.(group.id)
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {isGroupFollowed?.(group.id)
                      ? "Following Group"
                      : "Follow Group"}
                  </button>
                )}
              </motion.article>
            );
          })}
        </motion.div>
      ) : (
        <p className="mt-4 rounded-[1.25rem] border border-dashed border-border bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
          No communities available yet. Create one below to get started.
        </p>
      )}
    </motion.section>
  );
}
