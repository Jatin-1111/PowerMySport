"use client";

import { motion } from "framer-motion";
import { shellVariants } from "@/modules/community/constants/communityPage";
import { useCommunityPage } from "@/modules/community/hooks/useCommunityPage";
import CommunityPageLoading from "@/modules/community/components/page/home/CommunityPageLoading";
import CommunityOverviewPanel from "@/modules/community/components/page/home/CommunityOverviewPanel";
import CommunityConversationsWorkspace from "@/modules/community/components/page/home/CommunityConversationsWorkspace";
import CommunityPageModals from "@/modules/community/components/page/home/CommunityPageModals";

export default function CommunityHomeClient({ forceView }: { forceView?: "community-overview" | "conversations" } = {}) {
  const page = useCommunityPage(forceView ? { forceView } : undefined);

  if (page.isLoading) {
    return <CommunityPageLoading page={page} />;
  }

  const { prefersReducedMotion, isCommunityView, isConversationsView } = page;

  return (
    <>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28 }}
        className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)]"
      >
        <motion.div
          variants={shellVariants}
          initial="hidden"
          animate="show"
          className="mx-auto grid h-full min-h-0 w-full max-w-full gap-0 grid-cols-1"
        >
          {isCommunityView && <CommunityOverviewPanel page={page} />}
          {isConversationsView && (
            <CommunityConversationsWorkspace page={page} />
          )}
        </motion.div>
      </motion.div>

      <CommunityPageModals page={page} />
    </>
  );
}
