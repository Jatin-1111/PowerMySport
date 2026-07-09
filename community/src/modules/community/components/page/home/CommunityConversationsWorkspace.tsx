"use client";

import { motion } from "framer-motion";
import { panelVariants } from "@/modules/community/constants/communityPage";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";
import CommunityChatPanel from "@/modules/community/components/page/home/CommunityChatPanel";
import CommunityDirectoryPanel from "@/modules/community/components/page/home/CommunityDirectoryPanel";
import CommunityGroupInsightsPanel from "@/modules/community/components/page/home/CommunityGroupInsightsPanel";
import ChatDetailsSidebar from "@/modules/community/components/page/home/ChatDetailsSidebar";
import CommunityMobileDock from "@/modules/community/components/page/home/CommunityMobileDock";

type Props = { page: CommunityPageViewModel };

export default function CommunityConversationsWorkspace({ page }: Props) {
  return (
    <div className="contents">
      <motion.main
        variants={panelVariants}
        className="relative grid flex-1 min-h-0 min-w-0 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]"
      >
        <CommunityDirectoryPanel page={page} />
        <CommunityChatPanel page={page} />
        <CommunityGroupInsightsPanel page={page} />
        <ChatDetailsSidebar page={page} />
        <CommunityMobileDock page={page} />
      </motion.main>
    </div>
  );
}
