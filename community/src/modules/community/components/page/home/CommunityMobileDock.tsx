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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-0.5 p-2">
        <button
          onClick={() => {
            setWorkspaceView(selectedConversationId ? "CHAT" : "DIRECTORY");
            setSidebarMode("INBOX");
          }}
          className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${activeMobileDockTab === "CHAT" ? "text-power-orange" : "text-slate-600"}`}
        >
          <MessageSquare size={20} /> Chat
        </button>
        <button
          onClick={() => {
            setSidebarMode("INBOX");
            setWorkspaceView("DIRECTORY");
          }}
          className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${activeMobileDockTab === "LIST" ? "text-power-orange" : "text-slate-600"}`}
        >
          <Users size={20} /> Chats
        </button>
        <button
          onClick={() => {
            setSidebarMode("TOOLS");
            setWorkspaceView("DIRECTORY");
            setDirectoryView("GROUPS");
          }}
          className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${activeMobileDockTab === "TOOLS" ? "text-power-orange" : "text-slate-600"}`}
        >
          <Search size={20} /> Tools
        </button>
      </div>
    </nav>
  );
}
