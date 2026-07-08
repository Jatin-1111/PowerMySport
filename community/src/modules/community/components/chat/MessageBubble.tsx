import { memo, useRef, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  CheckCheck,
  Copy,
  ImageIcon,
  Pencil,
  RotateCcw,
  Trash2,
  AlertCircle,
  Smile,
  Pin,
  BookmarkCheck,
  Forward,
} from "lucide-react";
import type { ConversationMessage } from "@/modules/community/types";
import {
  getAvatarCharacter,
  getMessageTimestamp,
  isWithinMessageEditWindow,
} from "../../utils/chatUtils";
import EmojiPicker from "./EmojiPicker";

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
  onReact?: (message: ConversationMessage, emoji: string) => void;
  onForward?: (message: ConversationMessage) => void;
  onPin?: (message: ConversationMessage) => void;
  onMarkUnread?: (message: ConversationMessage) => void;
  isPinned?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
  onClickName?: (message: ConversationMessage) => void;
};

/** Build the public S3/CDN URL for a chat image given its object key. */
function buildChatImageUrl(s3Key: string): string {
  const domain = process.env.NEXT_PUBLIC_CHAT_BUCKET_DOMAIN;
  if (!domain || !s3Key) return "";
  return `https://${domain}/${s3Key}`;
}

/** Skeleton shown while an image is uploading (optimistic state). */
function ImageUploadingPlaceholder({ isOwn }: { isOwn: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${isOwn ? "bg-orange-400/40" : "bg-slate-200"}`}
      style={{ width: "100%", maxWidth: 240, aspectRatio: "4/3" }}
      aria-label="Uploading image…"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <ImageIcon
          size={28}
          className={isOwn ? "text-orange-100/70" : "text-slate-400"}
        />
        <span
          className={`text-xs font-medium ${isOwn ? "text-orange-100/80" : "text-slate-500"}`}
        >
          Uploading…
        </span>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-3/4 origin-left animate-pulse rounded-full bg-white/60" />
        </div>
      </div>
    </div>
  );
}

/** The image content — renders once the upload is complete. */
function ImageMessageContent({
  src,
  width,
  height,
}: {
  src: string;
  width?: number | null;
  height?: number | null;
  isOwn: boolean;
}) {
  const aspectRatio =
    width && height && width > 0 && height > 0 ? width / height : 4 / 3;
  const maxDisplayWidth = 260;
  const displayWidth = Math.min(width ?? maxDisplayWidth, maxDisplayWidth);
  const displayHeight = Math.round(displayWidth / aspectRatio);

  if (!src) return null;

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-power-orange/60"
      style={{ width: displayWidth, maxWidth: "100%", height: displayHeight }}
      aria-label="View full image"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Shared image"
        width={displayWidth}
        height={displayHeight}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover transition-opacity duration-300 hover:opacity-90"
        style={{ display: "block" }}
      />
    </a>
  );
}

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
  onReact,
  onForward,
  onPin,
  onMarkUnread,
  isPinned,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onClickName,
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

  const isImageMessage = message.type === "IMAGE";
  const isUploading = isImageMessage && message.messageStatus === "SENDING";
  const isFailed = message.messageStatus === "FAILED";

  const hasBeenSeenByOther = Boolean(
    isOwnMessage &&
    otherParticipantId &&
    message.readBy?.includes(otherParticipantId),
  );
  const hasBeenDeliveredToOther = Boolean(
    isOwnMessage &&
    otherParticipantId &&
    message.deliveredTo?.includes(otherParticipantId),
  );
  const canMutateMessage =
    !isImageMessage &&
    isOwnMessage &&
    !message.isDeleted &&
    message.messageStatus !== "FAILED" &&
    isWithinMessageEditWindow(message.createdAt);

  const bubbleShapeClass = isOwnMessage
    ? "rounded-[20px] rounded-br-[6px]"
    : "rounded-[20px] rounded-bl-[6px]";

  const canOpenMobileActions =
    (isOwnMessage && isFailed) || !message.isDeleted || canMutateMessage;

  const senderAvatarChar = getAvatarCharacter(message.senderDisplayName);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [localReaction, setLocalReaction] = useState<string | null>(null);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setLocalReaction(emoji);
    onReact?.(message, emoji);
    setShowReactionPicker(false);
  }, [message, onReact]);

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

  const imageSrc = isImageMessage
    ? isUploading
      ? (message.localPreviewUrl ?? "")
      : buildChatImageUrl(message.content)
    : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`group/msg flex w-full gap-2 ${isFailed ? "opacity-80" : ""} ${isSelectMode ? "cursor-pointer" : ""}`}
      onClick={(e) => {
        if (isSelectMode) {
          e.stopPropagation();
          onToggleSelect?.(message.id);
        }
      }}
    >
      {/* Checkbox for Select Messages Mode */}
      {isSelectMode && (
        <div className={`mt-auto mb-1 flex items-center justify-center shrink-0`}>
          <button
            onClick={() => onToggleSelect?.(message.id)}
            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${isSelected
                ? "bg-power-orange border-power-orange text-white"
                : "border-slate-300 bg-white"
              }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </button>
        </div>
      )}

      {/* Bubble Wrapper */}
      <div className={`flex flex-1 gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
        {/* Group avatar (other's messages) */}
        {!isOwnMessage && isGroupConversation && (
          <div 
            onClick={onClickName ? () => onClickName(message) : undefined}
            className={`mt-auto mb-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-bold uppercase text-slate-700 shadow-sm ring-2 ring-white ${onClickName ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
          >
            {senderAvatarChar}
          </div>
        )}

        {/* Avatar for DM other's messages */}
        {!isOwnMessage && !isGroupConversation && (
          <div className="mt-auto mb-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[10px] font-bold uppercase text-slate-700 shadow-sm ring-2 ring-white">
            {senderAvatarChar}
          </div>
        )}

        <div className="relative max-w-[82%] sm:max-w-[75%] md:max-w-[68%] lg:max-w-[62%]">
          <div
            className={`relative ${isImageMessage ? "p-1.5" : "px-3.5 py-2 sm:px-4 sm:py-2.5"
              } ${bubbleShapeClass} text-[14px] shadow-sm transition-all ${isFailed ? "ring-2 ring-red-400/60" : ""
              } ${isOwnMessage
                ? "bg-orange-50 border border-orange-100 text-slate-800 shadow-[0_1px_3px_rgba(234,88,12,0.05)]"
                : "border border-slate-200/50 bg-white text-slate-800 shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
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
            {/* Sender name */}
            {!isOwnMessage && (
              <div
                onClick={(e) => {
                  if (message.senderDisplayName !== "Anonymous" && onClickName) {
                    e.stopPropagation();
                    onClickName(message);
                  }
                }}
                className={`mb-0.5 text-[11px] font-semibold text-power-orange ${isImageMessage ? "px-0.5" : ""} ${message.senderDisplayName !== "Anonymous" && onClickName ? "hover:underline cursor-pointer" : ""}`}
              >
                {message.senderDisplayName}
              </div>
            )}

            {/* ── Image message ── */}
            {isImageMessage ? (
              isUploading ? (
                <ImageUploadingPlaceholder isOwn={isOwnMessage} />
              ) : message.isDeleted ? (
                <div className="px-2 py-1 italic opacity-60 text-[13px] leading-5">
                  Image deleted
                </div>
              ) : (
                <>
                  <ImageMessageContent
                    src={imageSrc}
                    width={message.metadata?.width}
                    height={message.metadata?.height}
                    isOwn={isOwnMessage}
                  />
                  {message.metadata?.caption && !message.isDeleted && (
                    <div className="mt-1.5 px-0.5 pb-0.5 text-[13px] whitespace-pre-wrap leading-5">
                      {message.metadata.caption}
                    </div>
                  )}
                </>
              )
            ) : (
              /* ── Text message ── */
              <div
                className={`whitespace-pre-wrap leading-relaxed ${message.isDeleted ? "italic opacity-60" : ""
                  }`}
              >
                {message.isDeleted ? "This message was deleted" : message.content}
              </div>
            )}

            {/* ── Meta row: timestamp + receipts ── */}
            <div
              className={`mt-0.5 flex flex-wrap items-center gap-1 text-[10px] ${isOwnMessage
                  ? "justify-end text-orange-400/80"
                  : "justify-start text-slate-400"
                } ${isImageMessage ? "px-0.5" : ""}`}
            >
              {message.isEdited && !message.isDeleted && (
                <span className="opacity-70">(edited)</span>
              )}
            </div>

            {/* Reaction display */}
            <AnimatePresence>
              {localReaction && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`absolute -bottom-3 ${isOwnMessage ? "-left-3" : "-right-3"} z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-xs`}
                >
                  {localReaction}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Timestamp below bubble */}
          <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400 ${isOwnMessage ? "justify-end pr-1" : "justify-start pl-1"}`}>
            {isPinned && <Pin size={10} className="text-power-orange fill-power-orange" />}
            <span className="tabular-nums">
              {getMessageTimestamp(message.createdAt)}
            </span>

            {/* Delivery status moved next to time */}
            {isOwnMessage &&
              (isFailed ? (
                <span
                  title="Failed to send. Tap to retry."
                  className="text-red-400"
                >
                  <AlertCircle size={12} strokeWidth={2.2} />
                </span>
              ) : message.messageStatus === "SENDING" ? (
                <span className="opacity-70">
                  <RotateCcw size={10} className="animate-spin" />
                </span>
              ) : hasBeenSeenByOther ? (
                <span className="text-power-orange">
                  <CheckCheck size={13} strokeWidth={2.2} />
                </span>
              ) : hasBeenDeliveredToOther ? (
                <span className="opacity-80">
                  <CheckCheck size={13} strokeWidth={2.2} />
                </span>
              ) : (
                <span className="opacity-80">
                  <Check size={12} strokeWidth={2.2} />
                </span>
              ))}
          </div>

          <div
            className={`absolute hidden sm:flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 ${isOwnMessage
                ? "left-0 -translate-x-full pr-1 top-1/2 -translate-y-1/2"
                : "right-0 translate-x-full pl-1 top-1/2 -translate-y-1/2"
              }`}
          >
            <div className={`flex items-center gap-0.5 rounded-xl border border-slate-200/60 bg-white/95 backdrop-blur-sm shadow-md px-1 py-0.5 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
              {/* React */}
              {!message.isDeleted && (
                <div className="relative">
                  <button
                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                    title="React"
                  >
                    <Smile size={14} />
                  </button>
                  <AnimatePresence>
                    {showReactionPicker && (
                      <div className={`absolute bottom-full mb-2 z-50 ${isOwnMessage ? "right-0" : "left-0"}`}>
                        <EmojiPicker
                          onSelect={handleEmojiSelect}
                          onClose={() => setShowReactionPicker(false)}
                          alignRight={isOwnMessage}
                        />
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Copy */}
              {!message.isDeleted && !isImageMessage && (
                <button
                  onClick={() => onCopy(message)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                  title={isCopied ? "Copied!" : "Copy"}
                >
                  {isCopied ? <Check size={14} className="text-turf-green" /> : <Copy size={14} />}
                </button>
              )}

              {/* Forward */}
              {!message.isDeleted && (
                <button
                  onClick={() => onForward?.(message)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                  title="Forward"
                >
                  <Forward size={14} />
                </button>
              )}

              {/* Pin */}
              {!message.isDeleted && (
                <button
                  onClick={() => onPin?.(message)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${isPinned ? "text-power-orange bg-orange-50 hover:bg-orange-100" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }`}
                  title={isPinned ? "Unpin" : "Pin"}
                >
                  <Pin size={14} className={isPinned ? "fill-power-orange" : ""} />
                </button>
              )}

              {/* Retry */}
              {isOwnMessage && isFailed && (
                <button
                  onClick={() => onRetry(message)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-power-orange hover:bg-orange-50 transition"
                  title="Retry"
                >
                  <RotateCcw size={14} />
                </button>
              )}

              {/* Edit */}
              {canMutateMessage && (
                <button
                  onClick={() => onEdit(message)}
                  disabled={isMutating}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-50"
                  title={isEditing ? "Editing…" : "Edit"}
                >
                  <Pencil size={14} />
                </button>
              )}



              {/* Delete */}
              {!message.isDeleted && (
                <button
                  onClick={() => onDelete(message)}
                  disabled={isMutating}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
