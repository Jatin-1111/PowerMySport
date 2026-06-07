"use client";

import { AnimatePresence, motion } from "framer-motion";
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

  return (
                <AnimatePresence initial={false}>
                  {showGroupInsightsSidebar && selectedConversation?.group && (
                    <>
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowGroupMembersPanel(false)}
                        className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden"
                      />
                      <motion.section
                        initial={{ opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        className="fixed inset-y-0 right-0 z-50 w-[92vw] max-w-sm overflow-y-auto border-l border-border bg-white p-4 shadow-xl xl:w-95 xl:max-w-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-semibold tracking-tight">
                            Group Sidebar
                          </h3>
                          <button
                            onClick={() => setShowGroupMembersPanel(false)}
                            className="rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                          >
                            Close
                          </button>
                        </div>
                        <div className="mt-4">
                          <GroupMembersList
                            groupId={selectedConversation.group.id}
                            onMemberClick={handleMemberClick}
                          />
                        </div>
                      </motion.section>
                    </>
                  )}
                </AnimatePresence>
  );
}
