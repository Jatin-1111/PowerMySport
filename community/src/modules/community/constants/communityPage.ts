export const COMMUNITY_ACTIVE_TAB_KEY = "community:activeSidebarTab";
export const COMMUNITY_WORKSPACE_VIEW_KEY = "community:workspaceView";
export const COMMUNITY_DIRECTORY_VIEW_KEY = "community:directoryView";
export const COMMUNITY_SELECTED_CONVERSATION_KEY =
  "community:selectedConversationId";
export const COMMUNITY_SIDEBAR_MODE_KEY = "community:sidebarMode";
export const CONVERSATION_PAGE_SIZE = 25;
export const DISCONNECTED_POLL_BASE_MS = 2500;
export const DISCONNECTED_POLL_MAX_MS = 30000;

export const shellVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const panelVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export type SidebarTab = "community-overview" | "conversations";
export type WorkspaceView = "CHAT" | "DIRECTORY" | "PRIVACY";
export type DirectoryView = "CONTACTS" | "GROUPS";
export type GroupToolsMode = "DISCOVER" | "MANAGE" | "INVITE";
export type SidebarMode = "INBOX" | "TOOLS";

export const isValidSidebarTab = (value: string | null): value is SidebarTab =>
  value === "community-overview" || value === "conversations";

export const isValidWorkspaceView = (
  value: string | null,
): value is WorkspaceView =>
  value === "CHAT" || value === "DIRECTORY" || value === "PRIVACY";

export const isValidDirectoryView = (
  value: string | null,
): value is DirectoryView => value === "CONTACTS" || value === "GROUPS";

export const isValidGroupToolsMode = (
  value: string | null,
): value is GroupToolsMode =>
  value === "DISCOVER" || value === "MANAGE" || value === "INVITE";

export const resolveSidebarQueryState = (value: string | null) => {
  const normalized = value?.trim().toLowerCase() || "";
  if (!normalized) return {};
  if (normalized === "tools") return { mode: "TOOLS" as const };
  if (normalized === "inbox") return { mode: "INBOX" as const };
  if (normalized === "community-overview")
    return { mode: "INBOX" as const, tab: "community-overview" as const };
  if (normalized === "conversations")
    return { mode: "INBOX" as const, tab: "conversations" as const };
  return {};
};
