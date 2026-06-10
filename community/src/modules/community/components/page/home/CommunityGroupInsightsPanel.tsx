"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GroupMembersList } from "@/modules/community/components/GroupMembersList";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityGroupInsightsPanel({ page }: Props) {
  const {
    showGroupInsightsSidebar,
    selectedConversation,
    setShowGroupMembersPanel,
    handleMemberClick,
  } = page;

  const [membersCount, setMembersCount] = useState(0);

  return (
    <AnimatePresence initial={false}>
      {showGroupInsightsSidebar && selectedConversation?.group && (
        <>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGroupMembersPanel(false)}
            className="absolute inset-0 z-40 bg-slate-900/40 xl:hidden"
          />
          <motion.section
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="absolute inset-y-0 right-0 z-50 w-[92vw] max-w-sm overflow-y-auto border-l border-border bg-white p-4 shadow-xl xl:w-95 xl:max-w-none flex flex-col"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 flex-none">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-slate-900">
                    Group Members
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {membersCount}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  All members in this community group
                </p>
              </div>
              <button
                onClick={() => setShowGroupMembersPanel(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none shrink-0"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
              <GroupMembersList
                groupId={selectedConversation.group.id}
                onMemberClick={handleMemberClick}
                onMembersCountChange={setMembersCount}
              />
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
