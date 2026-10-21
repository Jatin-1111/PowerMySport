"use client";

import { MessageSquare, Search, Users } from "lucide-react";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

type Props = { page: CommunityPageViewModel };

export default function CommunityMobileDock({ page }: Props) {
  const {
    isConversationsView,
    workspaceView,
    selectedConversationId,
    setWorkspaceView,
    setSidebarMode,
    setDirectoryView,
    activeMobileDockTab,
  } = page;

  if (!isConversationsView || workspaceView === "CHAT") {
    return null;
  }

  return (
    <nav className="border-hairline bg-paper fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-0.5 p-2">
        <button
          onClick={() => {
            setWorkspaceView(selectedConversationId ? "CHAT" : "DIRECTORY");
            setSidebarMode("INBOX");
          }}
          className={`flex min-h-12 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-200 ${activeMobileDockTab === "CHAT" ? "bg-paper-deep text-ink font-semibold" : "text-ink-body"}`}
        >
          <MessageSquare size={20} /> Chat
        </button>
        <button
          onClick={() => {
            setSidebarMode("INBOX");
            setWorkspaceView("DIRECTORY");
          }}
          className={`flex min-h-12 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-200 ${activeMobileDockTab === "LIST" ? "bg-paper-deep text-ink font-semibold" : "text-ink-body"}`}
        >
          <Users size={20} /> Chats
        </button>
        <button
          onClick={() => {
            setSidebarMode("TOOLS");
            setWorkspaceView("DIRECTORY");
            setDirectoryView("GROUPS");
          }}
          className={`flex min-h-12 flex-col items-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-200 ${activeMobileDockTab === "TOOLS" ? "bg-paper-deep text-ink font-semibold" : "text-ink-body"}`}
        >
          <Search size={20} /> Tools
        </button>
      </div>
    </nav>
  );
}
