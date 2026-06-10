"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { FeaturedCommunitiesStrip } from "@/modules/community/components/FeaturedCommunitiesStrip";
import { communityFollowStore } from "@/modules/community/lib/followStore";
import { toast } from "@/lib/toast";
import { shellVariants, panelVariants } from "@/modules/community/constants/communityPage";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityOverviewPanel({ page }: Props) {
  const {
    setActiveSidebarTab,
    setSidebarMode,
    setWorkspaceView,
    setDirectoryView,
    mainAppUrl,
    featuredGroups,
    getFeaturedGroupActionLabel,
    handleFeaturedGroupAction,
    followedGroupIds,
    setFollowedGroupIds,
    conversations: safeConversations,
    totalUnread,
    groupsJoinedCount,
    isSocketConnected,
  } = page;

  return (
    <motion.main
              variants={panelVariants}
              className="flex min-h-full min-w-0 flex-col overflow-y-auto lg:h-full"
            >
              <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
                <section id="community-overview" className="mb-6 scroll-mt-28">
                  <CommunityPageHeader
                    title="PowerMySport Community"
                    subtitle="Anonymous-first community chat with your privacy controls."
                    badge="Community Network"
                    action={
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSidebarTab("conversations");
                            setSidebarMode("INBOX");
                            setWorkspaceView("DIRECTORY");
                            setDirectoryView("CONTACTS");
                          }}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        >
                          Open chats
                        </button>
                        <Link
                          href="/q"
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        >
                          Explore Q&A
                        </Link>
                        <a
                          href={mainAppUrl}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        >
                          Switch to Main App <ExternalLink size={16} />
                        </a>
                      </div>
                    }
                  />
                </section>

                <FeaturedCommunitiesStrip
                  groups={featuredGroups}
                  getActionLabel={getFeaturedGroupActionLabel}
                  onGroupAction={(group) => {
                    void handleFeaturedGroupAction(group);
                  }}
                  isGroupFollowed={(groupId) =>
                    followedGroupIds.includes(groupId)
                  }
                  onToggleGroupFollow={(group) => {
                    const result = communityFollowStore.toggle({
                      kind: "group",
                      id: group.id,
                      label: group.name,
                      href: `/`,
                    });
                    setFollowedGroupIds(
                      communityFollowStore
                        .getByKind("group")
                        .map((item) => item.id),
                    );
                    toast.success(
                      result.following
                        ? `Following ${group.name}`
                        : `Unfollowed ${group.name}`,
                    );
                  }}
                  onViewAll={() => {
                    setActiveSidebarTab("conversations");
                    setWorkspaceView("DIRECTORY");
                    setDirectoryView("GROUPS");
                  }}
                />

                <motion.section
                  variants={shellVariants}
                  initial="hidden"
                  animate="show"
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <motion.div
                    variants={panelVariants}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conversations
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {safeConversations.length}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Active threads
                    </p>
                  </motion.div>
                  <motion.div
                    variants={panelVariants}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Unread
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {totalUnread}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Messages waiting
                    </p>
                  </motion.div>
                  <motion.div
                    variants={panelVariants}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Groups joined
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {groupsJoinedCount}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Community circles
                    </p>
                  </motion.div>
                  <motion.div
                    variants={panelVariants}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Connection
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {isSocketConnected ? "Realtime" : "Polling"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isSocketConnected
                        ? "Instant updates"
                        : "Auto-refreshing"}
                    </p>
                  </motion.div>
                </motion.section>
              </div>
    </motion.main>
  );
}
