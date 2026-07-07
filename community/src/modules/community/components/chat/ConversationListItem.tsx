import { memo } from "react";
import { motion } from "framer-motion";
import type { ConversationItem } from "@/modules/community/types";
import { getAvatarCharacter, getRelativeTime } from "../../utils/chatUtils";

type ConversationListItemProps = {
  conversation: ConversationItem;
  isSelected: boolean;
  onOpenConversation: (conversationId: string) => void;
};

export const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  onOpenConversation,
}: ConversationListItemProps) {
  const conversationName =
    conversation.conversationType === "GROUP"
      ? conversation.group?.name || conversation.otherParticipant.displayName
      : conversation.otherParticipant.displayName;
  const conversationPhotoUrl =
    conversation.conversationType === "GROUP"
      ? null
      : (conversation.otherParticipant.photoUrl ?? null);
  const conversationAvatarChar = getAvatarCharacter(conversationName);

  return (
    <motion.button
      layout
      onClick={() => onOpenConversation(conversation.id)}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full overflow-hidden px-4 py-3 sm:py-3.5 text-left transition-all ${
        isSelected
          ? "bg-gradient-to-r from-orange-50/80 to-transparent"
          : "bg-white hover:bg-slate-50 active:bg-slate-100/60"
      }`}
    >
      {/* Active Indicator Line */}
      {isSelected && (
        <motion.div
          layoutId="activeConversationLine"
          className="absolute left-0 top-0 bottom-0 w-1 bg-power-orange rounded-r-full"
        />
      )}

      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-3.5">
          {/* Avatar */}
          <div className="relative inline-flex h-12 w-12 sm:h-[52px] sm:w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] sm:rounded-[22px] bg-gradient-to-br from-slate-100 to-slate-200 text-[15px] font-bold uppercase text-slate-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_1px_3px_rgba(0,0,0,0.05)]">
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

            {/* Online/Activity Indicator could go here in future */}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <p
                  className={`truncate text-[15px] sm:text-[16px] tracking-tight ${
                    conversation.unreadCount > 0
                      ? "font-600 text-slate-900"
                      : "font-500 text-slate-800"
                  }`}
                >
                  {conversationName}
                </p>
                {conversation.status === "PENDING" && (
                  <span className="shrink-0 rounded-full bg-orange-100/80 border border-orange-200/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                    Request
                  </span>
                )}
              </div>

              {/* Timestamp */}
              <div className="shrink-0 flex items-center justify-end">
                {conversation.latestMessage?.createdAt && (
                  <span
                    className={`text-[12px] font-medium leading-none tabular-nums ${
                      conversation.unreadCount > 0
                        ? "text-power-orange"
                        : "text-slate-400"
                    }`}
                  >
                    {getRelativeTime(conversation.latestMessage.createdAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p
                className={`line-clamp-1 text-[13px] sm:text-[14px] ${
                  conversation.unreadCount > 0
                    ? "font-medium text-slate-800"
                    : "text-slate-500"
                }`}
              >
                {conversation.status === "PENDING"
                  ? "Sent you a message request"
                  : conversation.latestMessage?.content || (
                      <span className="italic opacity-70">No messages yet</span>
                    )}
              </p>

              {/* Unread Badge */}
              <div className="flex shrink-0 items-center justify-end w-6">
                {conversation.unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-gradient-to-b from-power-orange to-orange-600 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-md shadow-orange-500/20"
                  >
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </motion.span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle separator line (hidden on last item, handled by parent typically or just rely on bg differences) */}
      {!isSelected && (
        <div className="absolute bottom-0 left-[76px] right-0 h-px bg-gradient-to-r from-slate-100 to-transparent" />
      )}
    </motion.button>
  );
});
