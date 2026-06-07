"use client";

import { motion } from "framer-motion";
import { panelVariants } from "@/modules/community/constants/communityPage";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";
import CommunityChatPanel from "@/modules/community/components/page/home/CommunityChatPanel";
import CommunityDirectoryPanel from "@/modules/community/components/page/home/CommunityDirectoryPanel";
import CommunityGroupInsightsPanel from "@/modules/community/components/page/home/CommunityGroupInsightsPanel";
import CommunityMobileDock from "@/modules/community/components/page/home/CommunityMobileDock";

type Props = { page: CommunityPageViewModel };

export default function CommunityConversationsWorkspace({ page }: Props) {
  return (
    <div className="contents">
      <motion.main
        variants={panelVariants}
        className="grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]"
      >
        <CommunityDirectoryPanel page={page} />
        <CommunityChatPanel page={page} />
        <CommunityGroupInsightsPanel page={page} />
        <CommunityMobileDock page={page} />
      </motion.main>
    </div>
  );
}
