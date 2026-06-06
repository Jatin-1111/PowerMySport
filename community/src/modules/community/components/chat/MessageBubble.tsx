import { memo, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCheck,
  Copy,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { ConversationMessage } from "@/modules/community/types";
import {
  getAvatarCharacter,
  getMessageTimestamp,
  isWithinMessageEditWindow,
} from "../../utils/chatUtils";

type MessageBubbleProps = {
  message: ConversationMessage;
  isOwnMessage: boolean;
  isGroupConversation: boolean;
  profileUserId?: string;
  onOpenMobileActions?: (message: ConversationMessage) => void;
  onRetry: (message: ConversationMessage) => void;
  onEdit: (message: ConversationMessage) => void;
  onDelete: (message: ConversationMessage) => void;
  onCopy: (message: ConversationMessage) => void;
  isCopied: boolean;
  isEditing: boolean;
  isMutating: boolean;
};

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwnMessage,
  isGroupConversation,
  profileUserId,
  onOpenMobileActions,
  onRetry,
  onEdit,
  onDelete,
  onCopy,
  isCopied,
  isEditing,
  isMutating,
}: MessageBubbleProps) {
  const participantIds = Array.isArray(message.participantIds)
    ? message.participantIds
    : [];
  let otherParticipantId: string | undefined;
  for (const participantId of participantIds) {
    if (participantId !== profileUserId) {
      otherParticipantId = participantId;
      break;
    }
  }

  const hasBeenSeenByOther = Boolean(
    isOwnMessage &&
    otherParticipantId &&
    message.readBy?.includes(otherParticipantId),
  );
  const canMutateMessage =
    isOwnMessage &&
    !message.isDeleted &&
    message.messageStatus !== "FAILED" &&
    isWithinMessageEditWindow(message.createdAt);
  const bubbleShapeClass = isOwnMessage
    ? "rounded-2xl rounded-br-[5px]"
    : "rounded-2xl rounded-bl-[5px]";
  const canOpenMobileActions =
    (isOwnMessage && message.messageStatus === "FAILED") ||
    !message.isDeleted ||
    canMutateMessage;
  const senderAvatarChar = getAvatarCharacter(message.senderDisplayName);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearLongPressTimeout = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const openMobileActions = useCallback(() => {
    if (!onOpenMobileActions || !canOpenMobileActions) return;
    onOpenMobileActions(message);
  }, [canOpenMobileActions, message, onOpenMobileActions]);

  const startLongPress = useCallback(() => {
    if (!onOpenMobileActions || !canOpenMobileActions) return;
    if (typeof window !== "undefined") {
      const isMobileViewport = window.matchMedia("(max-width: 639px)").matches;
      if (!isMobileViewport) return;
    }
    clearLongPressTimeout();
    longPressTimeoutRef.current = setTimeout(() => {
      openMobileActions();
      clearLongPressTimeout();
    }, 380);
  }, [
    canOpenMobileActions,
    clearLongPressTimeout,
    onOpenMobileActions,
    openMobileActions,
  ]);

  useEffect(() => {
    return () => clearLongPressTimeout();
  }, [clearLongPressTimeout]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      {!isOwnMessage && isGroupConversation && (
        <div className="mt-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold uppercase text-slate-700">
          {senderAvatarChar}
        </div>
      )}

      <div
        className={`max-w-[84%] ${bubbleShapeClass} px-3 py-1.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] sm:max-w-[78%] sm:px-3.5 sm:py-2 sm:text-sm lg:max-w-[65%] ${
          isOwnMessage
            ? "bg-[linear-gradient(135deg,#E97316,#F59E0B)] text-white"
            : "border border-slate-200 bg-white text-slate-800"
        }`}
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPressTimeout}
        onTouchCancel={clearLongPressTimeout}
        onMouseDown={startLongPress}
        onMouseUp={clearLongPressTimeout}
        onMouseLeave={clearLongPressTimeout}
        onContextMenu={(event) => {
          if (typeof window !== "undefined") {
            const isMobileViewport =
              window.matchMedia("(max-width: 639px)").matches;
            if (isMobileViewport && canOpenMobileActions) {
              event.preventDefault();
              openMobileActions();
            }
          }
        }}
      >
        {isGroupConversation && !isOwnMessage && (
          <div className="mb-0.5 text-[12px] font-600 text-power-orange">
            {message.senderDisplayName}
          </div>
        )}

        <div className="whitespace-pre-wrap wrap-break-word leading-5 sm:leading-6">
          {message.content}
        </div>

        <div
          className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs ${
            isOwnMessage ? "justify-end" : "justify-start"
          } ${isOwnMessage ? "text-orange-100/90" : "text-slate-500"}`}
        >
          {message.isDeleted && (
            <span className="italic opacity-75">Deleted</span>
          )}
          {message.isEdited && !message.isDeleted && (
            <span className="opacity-75">(edited)</span>
          )}
          <span className="font-normal leading-none tracking-[0.01em] tabular-nums opacity-90">
            {getMessageTimestamp(message.createdAt)}
          </span>
          {isOwnMessage &&
            (message.messageStatus === "FAILED" ? (
              <span className="font-medium text-red-100/95">!</span>
            ) : message.messageStatus === "SENDING" ? (
              <span className="font-medium opacity-80">...</span>
            ) : hasBeenSeenByOther ? (
              <span className="inline-flex items-center text-sky-200">
                <CheckCheck size={14} strokeWidth={2.2} />
              </span>
            ) : (
              <span className="inline-flex items-center opacity-85">
                <Check size={13} strokeWidth={2.2} />
              </span>
            ))}
        </div>

        <div
          className={`mt-1.5 hidden flex-wrap items-center gap-1 sm:mt-2 sm:flex sm:gap-1.5 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          {isOwnMessage && message.messageStatus === "FAILED" && (
            <button
              onClick={() => onRetry(message)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 ${
                isOwnMessage ? "text-orange-100/90" : "text-slate-600"
              }`}
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          )}
          {!message.isDeleted && (
            <button
              onClick={() => onCopy(message)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 ${
                isOwnMessage ? "text-orange-100/90" : "text-slate-600"
              }`}
            >
              {isCopied ? (
                <>
                  <Check size={12} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          {canMutateMessage && (
            <>
              <button
                onClick={() => onEdit(message)}
                disabled={isMutating}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isOwnMessage ? "text-orange-100/90" : "text-slate-600"
                }`}
              >
                <Pencil size={12} />
                <span>{isEditing ? "Editing..." : "Edit"}</span>
              </button>
              <button
                onClick={() => onDelete(message)}
                disabled={isMutating}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isOwnMessage ? "text-orange-100/90" : "text-red-600"
                }`}
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
