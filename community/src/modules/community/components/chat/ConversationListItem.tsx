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
      : conversation.otherParticipant.photoUrl ?? null;
  const conversationAvatarChar = getAvatarCharacter(conversationName);

  return (
    <motion.button
      onClick={() => onOpenConversation(conversation.id)}
      whileTap={{ scale: 0.995 }}
      className={`w-full min-h-18 border-b border-slate-100 px-3.5 py-2.5 text-left transition-all last:border-b-0 ${
        isSelected ? "bg-power-orange/10" : "bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700 shadow-sm">
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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-500 text-slate-900">
                {conversationName}
              </p>
              {conversation.status === "PENDING" && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Pending
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-slate-500">
              {conversation.status === "PENDING"
                ? "Message request"
                : conversation.latestMessage?.content || "No messages yet"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {conversation.latestMessage?.createdAt && (
            <span className="text-[11px] font-normal leading-none tabular-nums text-slate-400">
              {getRelativeTime(conversation.latestMessage.createdAt)}
            </span>
          )}
          {conversation.unreadCount > 0 && (
            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-power-orange px-1.5 py-0.5 text-[11px] font-bold text-white">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});