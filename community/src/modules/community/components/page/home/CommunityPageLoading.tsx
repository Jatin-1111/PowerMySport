"use client";

import { motion } from "framer-motion";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityPageLoading({ page }: Props) {
  const { prefersReducedMotion } = page;
  return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="min-h-screen bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] bg-position-[0_0,11px_11px] bg-size-[22px_22px]"
      >
        <div className="flex h-screen w-full">
          {/* Skeleton Sidebar (Inbox) */}
          <div className="hidden md:flex w-[320px] lg:w-[380px] flex-col border-r border-slate-200/50 bg-white/60 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-6 w-6 animate-pulse rounded-full bg-slate-200" />
              <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            </div>
            
            <div className="mb-4 h-10 w-full animate-pulse rounded-xl bg-slate-200/60" />
            
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-[22px] bg-slate-200/80" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200/80" />
                    <div className="h-3 w-40 animate-pulse rounded bg-slate-200/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Chat Panel */}
          <div className="flex-1 flex flex-col bg-white/30 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200/50 bg-white/50 p-4 backdrop-blur-md">
              <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-slate-200/60" />
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-6 space-y-8 overflow-hidden">
              {/* Other person bubble */}
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 shrink-0" />
                <div className="h-16 w-64 animate-pulse rounded-[24px] rounded-bl-[6px] bg-white/80 shadow-sm" />
              </div>

              {/* My bubble */}
              <div className="flex justify-end">
                <div className="h-12 w-48 animate-pulse rounded-[24px] rounded-br-[6px] bg-power-orange/10 shadow-sm" />
              </div>

              {/* Other person bubble */}
              <div className="flex items-end gap-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200 shrink-0" />
                <div className="space-y-2">
                  <div className="h-20 w-72 animate-pulse rounded-[24px] bg-white/80 shadow-sm" />
                  <div className="h-12 w-40 animate-pulse rounded-[24px] rounded-bl-[6px] bg-white/80 shadow-sm" />
                </div>
              </div>
            </div>

            {/* Composer */}
            <div className="border-t border-slate-200/50 bg-white/60 p-4 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
                <div className="h-12 flex-1 animate-pulse rounded-[24px] bg-white shadow-sm" />
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
  );
}
