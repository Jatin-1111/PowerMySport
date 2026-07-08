import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Users, MessageSquare, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CommunityPageViewModel } from "@/modules/community/hooks/useCommunityPage";

export function ChatAddModal({
  isOpen,
  onClose,
  mode,
  page,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "CONTACTS" | "GROUPS";
  page: CommunityPageViewModel;
}) {
  const router = useRouter();

  if (!isOpen) return null;

  const isGroup = mode === "GROUPS";
  const searchQuery = isGroup ? page.groupSearchQuery : page.playerSearchQuery;
  const setSearchQuery = isGroup ? page.setGroupSearchQuery : page.setPlayerSearchQuery;
  const isSearching = isGroup ? page.isSearchingGroups : page.isSearchingPlayers;
  
  const results = isGroup ? page.groupResults || [] : page.playerSearchResults || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">
              {isGroup ? "Search Groups" : "Search Users"}
            </h3>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search Body */}
          <div className="p-5">
            <div className="relative mb-6">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isGroup ? "Search communities..." : "Search for users..."}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm focus:border-power-orange/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/10 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {searchQuery ? (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Results
                  </p>
                  {isSearching && <Loader2 size={12} className="animate-spin text-power-orange" />}
                </div>
                
                {results.length === 0 && !isSearching && (
                  <p className="text-sm text-slate-500 text-center py-4">No results found.</p>
                )}

                {results.map((result: any) => {
                  const id = isGroup ? result.id : result.userId;
                  const name = isGroup ? result.name : result.displayName;
                  const subtitle = isGroup 
                    ? `${result.memberCount ?? 0} members` 
                    : result.city || result.sport || "Community member";
                  const photoUrl = isGroup ? result.bannerUrl : result.photoUrl;
                  
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {photoUrl ? (
                          <img src={photoUrl} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700">
                            {name?.charAt(0) || "?"}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (isGroup) {
                            if (result.isMember) {
                              const conv = page.getGroupConversationByGroupId(id);
                              if (conv) page.handleOpenConversation(conv.id);
                            } else {
                              page.handleJoinGroup(id);
                            }
                          } else {
                            page.handleStartConversation(id);
                          }
                          onClose();
                        }}
                        className={`shrink-0 rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95 ${
                          (isGroup && !result.isMember) 
                            ? "bg-power-orange text-white hover:bg-orange-600" 
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {isGroup ? (result.isMember ? "Chat" : "Join") : "Chat"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-power-orange">
                  {isGroup ? <Users size={24} /> : <MessageSquare size={24} />}
                </div>
                <p className="mb-2 text-[15px] font-semibold text-slate-700">
                  {isGroup
                    ? "Find your community"
                    : "Connect with players"}
                </p>
                <p className="mb-6 text-sm text-slate-500 max-w-[280px]">
                  {isGroup
                    ? "Search for existing groups or discover new communities to join."
                    : "Search for specific users to start a conversation with."}
                </p>

                <button
                  onClick={() => {
                    onClose();
                    router.push("/discover");
                  }}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 transition active:scale-95"
                >
                  Discover {isGroup ? "Groups" : "Users"}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
