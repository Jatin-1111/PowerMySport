import { memo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, BellOff, Volume2, MoreHorizontal } from "lucide-react";
import type { ConversationItem } from "@/modules/community/types";
import { getAvatarCharacter, formatChatListDate } from "../../utils/chatUtils";

type ConversationListItemProps = {
  conversation: ConversationItem;
  isSelected: boolean;
  isPinned: boolean;
  isMuted: boolean;
  onOpenConversation: (conversationId: string) => void;
  onTogglePin: (conversationId: string) => void;
  onToggleMute: (conversationId: string) => void;
  isSelectMode?: boolean;
  onToggleSelect?: (conversationId: string) => void;
};

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  isPinned,
  isMuted,
  onOpenConversation,
  onTogglePin,
  onToggleMute,
  isSelectMode,
  onToggleSelect,
}: ConversationListItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const conversationName =
    conversation.conversationType === "GROUP"
      ? conversation.group?.name || conversation.otherParticipant.displayName
      : conversation.otherParticipant.displayName;
  const conversationPhotoUrl =
    conversation.conversationType === "GROUP"
      ? null
      : (conversation.otherParticipant.photoUrl ?? null);
  const conversationAvatarChar = getAvatarCharacter(conversationName);

  // Truncate last message
  const lastMessageText =
    conversation.status === "PENDING"
      ? "Sent you a message request"
      : conversation.latestMessage?.content
        ? conversation.latestMessage.content.length > 38
          ? conversation.latestMessage.content.slice(0, 38) + "..."
          : conversation.latestMessage.content
        : "No messages yet";

  useEffect(() => {
    if (!showContextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showContextMenu]);

  return (
    <motion.div layout className="relative">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={isSelectMode}
        onClick={() => {
          if (!isSelectMode) onOpenConversation(conversation.id);
          else onToggleSelect?.(conversation.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isSelectMode) onOpenConversation(conversation.id);
            else onToggleSelect?.(conversation.id);
          }
        }}
        className={`relative w-full overflow-hidden px-3 py-2.5 text-left transition-all cursor-pointer ${
          isSelected && !isSelectMode
            ? "bg-slate-100"
            : "bg-white hover:bg-slate-50/80 active:bg-slate-100/60"
        }`}
      >

        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-[14px] font-bold uppercase text-slate-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_1px_3px_rgba(0,0,0,0.05)]">
            {conversationPhotoUrl ? (
              <img
                src={conversationPhotoUrl}
                alt={conversationName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              conversationAvatarChar
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {conversation.unreadCount > 0 && (
                  <div className="w-2 h-2 shrink-0 rounded-full bg-power-orange mt-0.5" />
                )}
                <p
                  className={`truncate text-[14px] tracking-tight ${
                    conversation.unreadCount > 0
                      ? "font-semibold text-slate-900"
                      : "font-medium text-slate-800"
                  }`}
                >
                  {conversationName}
                </p>
                {isPinned && (
                  <Pin
                    size={11}
                    className="shrink-0 text-slate-400 fill-slate-400"
                  />
                )}
                {isMuted && (
                  <BellOff size={11} className="shrink-0 text-slate-400" />
                )}
                {conversation.status === "PENDING" && (
                  <span className="shrink-0 rounded-full bg-orange-100/80 border border-orange-200/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700">
                    New
                  </span>
                )}
              </div>

              {/* Timestamp */}
              <div className="shrink-0 flex items-center gap-1.5">
                {conversation.latestMessage?.createdAt && (
                  <span
                    className={`text-[11px] font-medium leading-none tabular-nums ${
                      conversation.unreadCount > 0
                        ? "text-power-orange"
                        : "text-slate-400"
                    }`}
                  >
                    {formatChatListDate(conversation.latestMessage.createdAt)}
                  </span>
                )}
                {/* Context menu trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContextMenu((prev) => !prev);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-600 transition"
                  style={{ opacity: showContextMenu ? 1 : undefined }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p
                className={`truncate text-[12px] leading-tight ${
                  conversation.unreadCount > 0
                    ? "font-medium text-slate-700"
                    : "text-slate-500"
                }`}
              >
                {lastMessageText}
              </p>

              {/* Unread Badge */}
              {conversation.unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 inline-flex min-w-[18px] items-center justify-center rounded-full bg-gradient-to-b from-power-orange to-orange-600 px-1 py-0.5 text-[10px] font-bold text-white shadow-sm"
                >
                  {conversation.unreadCount > 99
                    ? "99+"
                    : conversation.unreadCount}
                </motion.span>
              )}
            </div>
          </div>
        </div>

        {/* Subtle separator line */}
        {!isSelected && (
          <div className="absolute bottom-0 left-[64px] right-0 h-px bg-gradient-to-r from-slate-100 to-transparent" />
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-3 top-1 z-30 w-40 rounded-xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] overflow-hidden"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(conversation.id);
                setShowContextMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <Pin size={14} className={isPinned ? "fill-power-orange text-power-orange" : ""} />
              {isPinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute(conversation.id);
                setShowContextMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              {isMuted ? (
                <>
                  <Volume2 size={14} /> Unmute
                </>
              ) : (
                <>
                  <BellOff size={14} /> Mute
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
