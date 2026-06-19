import { memo, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCheck,
  Copy,
  ImageIcon,
  Pencil,
  RotateCcw,
  Trash2,
  AlertCircle,
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
        <span className={`text-xs font-medium ${isOwn ? "text-orange-100/80" : "text-slate-500"}`}>
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
  // Clamp to a sensible max for the bubble width constraint
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

  // Shape the tail of the bubble
  const bubbleShapeClass = isOwnMessage
    ? "rounded-[24px] rounded-br-[6px]"
    : "rounded-[24px] rounded-bl-[6px]";

  const canOpenMobileActions =
    (isOwnMessage && isFailed) || !message.isDeleted || canMutateMessage;

  const senderAvatarChar = getAvatarCharacter(message.senderDisplayName);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [canOpenMobileActions, clearLongPressTimeout, onOpenMobileActions, openMobileActions]);

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
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex gap-2 sm:gap-2.5 ${isOwnMessage ? "justify-end" : "justify-start"} ${isFailed ? "opacity-80" : ""}`}
    >
      {/* Group avatar (other's messages) */}
      {!isOwnMessage && isGroupConversation && (
        <div className="mt-auto mb-1 inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[11px] font-bold uppercase text-slate-700 shadow-sm ring-2 ring-white">
          {senderAvatarChar}
        </div>
      )}

      <div
        className={`${
          isImageMessage ? "p-1.5" : "px-4 py-2.5 sm:px-5 sm:py-3"
        } max-w-[85%] ${bubbleShapeClass} text-[14px] sm:text-[15px] shadow-sm sm:max-w-[78%] md:max-w-[70%] lg:max-w-[65%] transition-all ${
          isFailed
            ? "ring-2 ring-red-400/60"
            : ""
        } ${
          isOwnMessage
            ? "bg-gradient-to-br from-power-orange to-orange-500 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_2px_5px_rgba(233,115,22,0.15)]"
            : "border border-slate-200/60 bg-white text-slate-800 shadow-[0_2px_5px_rgba(0,0,0,0.02)]"
        }`}
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPressTimeout}
        onTouchCancel={clearLongPressTimeout}
        onMouseDown={startLongPress}
        onMouseUp={clearLongPressTimeout}
        onMouseLeave={clearLongPressTimeout}
        onContextMenu={(event) => {
          if (typeof window !== "undefined") {
            const isMobileViewport = window.matchMedia("(max-width: 639px)").matches;
            if (isMobileViewport && canOpenMobileActions) {
              event.preventDefault();
              openMobileActions();
            }
          }
        }}
      >
        {/* Sender name in group chats */}
        {isGroupConversation && !isOwnMessage && (
          <div className={`mb-1 text-[11px] font-semibold text-power-orange ${isImageMessage ? "px-0.5" : ""}`}>
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
            className={`whitespace-pre-wrap leading-relaxed ${
              message.isDeleted ? "italic opacity-60" : ""
            }`}
          >
            {message.isDeleted ? "This message was deleted" : message.content}
          </div>
        )}

        {/* ── Meta row: timestamp + receipts ── */}
        <div
          className={`mt-1 flex flex-wrap items-center gap-1 text-[11px] ${
            isOwnMessage ? "justify-end text-orange-100/80" : "justify-start text-slate-400"
          } ${isImageMessage ? "px-0.5" : ""}`}
        >
          {message.isEdited && !message.isDeleted && (
            <span className="opacity-70">(edited)</span>
          )}
          <span className="tabular-nums opacity-90">
            {getMessageTimestamp(message.createdAt)}
          </span>

          {/* Delivery status */}
          {isOwnMessage && (
            isFailed ? (
              <span title="Failed to send. Tap to retry." className="text-red-200">
                <AlertCircle size={13} strokeWidth={2.2} />
              </span>
            ) : message.messageStatus === "SENDING" ? (
              <span className="opacity-70">
                <RotateCcw size={11} className="animate-spin" />
              </span>
            ) : hasBeenSeenByOther ? (
              <span className="text-sky-300">
                <CheckCheck size={14} strokeWidth={2.2} />
              </span>
            ) : hasBeenDeliveredToOther ? (
              <span className="opacity-80">
                <CheckCheck size={14} strokeWidth={2.2} />
              </span>
            ) : (
              <span className="opacity-80">
                <Check size={13} strokeWidth={2.2} />
              </span>
            )
          )}
        </div>

        {/* ── Desktop action buttons ── */}
        <div
          className={`mt-1.5 hidden flex-wrap items-center gap-1 sm:flex ${
            isOwnMessage ? "justify-end" : "justify-start"
          } ${isImageMessage ? "px-0.5" : ""}`}
        >
          {isOwnMessage && isFailed && (
            <button
              onClick={() => onRetry(message)}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition active:scale-95 ${
                isOwnMessage ? "text-orange-100 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <RotateCcw size={11} />
              <span>Retry</span>
            </button>
          )}
          {!message.isDeleted && !isImageMessage && (
            <button
              onClick={() => onCopy(message)}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition active:scale-95 ${
                isOwnMessage ? "text-orange-100 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {isCopied ? (
                <>
                  <Check size={11} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
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
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isOwnMessage ? "text-orange-100 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Pencil size={11} />
                <span>{isEditing ? "Editing…" : "Edit"}</span>
              </button>
              <button
                onClick={() => onDelete(message)}
                disabled={isMutating}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isOwnMessage ? "text-orange-100 hover:bg-white/10" : "text-red-500 hover:bg-red-50"
                }`}
              >
                <Trash2 size={11} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
