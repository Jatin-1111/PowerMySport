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

/** Build the public S3 URL for a chat image given its object key. */
function buildChatImageUrl(s3Key: string): string {
  const domain = process.env.NEXT_PUBLIC_CHAT_BUCKET_DOMAIN;
  if (!domain || !s3Key) return "";
  return `https://${domain}/${s3Key}`;
}

/** Skeleton shown while an image is uploading (optimistic state). */
function ImageUploadingPlaceholder({ isOwn }: { isOwn: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl ${isOwn ? "bg-orange-400/30" : "bg-slate-200"}`}
      style={{ width: 220, height: 165 }}
      aria-label="Uploading image…"
    >
      {/* shimmer wave */}
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/25 to-transparent" />
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
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-full origin-left animate-pulse rounded-full bg-white/60" />
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
  const displayWidth = Math.min(width ?? 280, 280);
  const displayHeight = Math.round(displayWidth / aspectRatio);

  if (!src) return null;

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-xl"
      style={{ width: displayWidth, height: displayHeight }}
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
    !isImageMessage && // images are not editable
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

  // Resolve image src:
  //  - SENDING: localPreviewUrl (blob object URL for instant preview)
  //  - Otherwise: public S3 URL constructed from bucket domain + object key
  const imageSrc = isImageMessage
    ? isUploading
      ? (message.localPreviewUrl ?? "")
      : buildChatImageUrl(message.content)
    : "";

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
        className={`${isImageMessage ? "p-1.5" : "px-3 py-1.5 sm:px-3.5 sm:py-2"} max-w-[84%] ${bubbleShapeClass} text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] sm:max-w-[78%] sm:text-sm lg:max-w-[65%] ${
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
          <div
            className={`mb-0.5 text-[12px] font-600 text-power-orange ${isImageMessage ? "px-1" : ""}`}
          >
            {message.senderDisplayName}
          </div>
        )}

        {/* ── Image message body ────────────────────────────────────── */}
        {isImageMessage ? (
          isUploading ? (
            <ImageUploadingPlaceholder isOwn={isOwnMessage} />
          ) : message.isDeleted ? (
            <div className="px-2 py-1 italic opacity-70 leading-5">
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
                <div className="mt-1.5 px-1 pb-0.5 whitespace-pre-wrap wrap-break-word leading-5 sm:leading-6">
                  {message.metadata.caption}
                </div>
              )}
            </>
          )
        ) : (
          /* ── Text message body ───────────────────────────────────── */
          <div className="whitespace-pre-wrap wrap-break-word leading-5 sm:leading-6">
            {message.content}
          </div>
        )}

        {/* ── Timestamp + read receipts ──────────────────────────────── */}
        <div
          className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs ${
            isOwnMessage ? "justify-end" : "justify-start"
          } ${isOwnMessage ? "text-orange-100/90" : "text-slate-500"} ${isImageMessage ? "px-1" : ""}`}
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
              <span className="inline-flex items-center text-sky-400">
                <CheckCheck size={14} strokeWidth={2.2} />
              </span>
            ) : hasBeenDeliveredToOther ? (
              <span className="inline-flex items-center opacity-85">
                <CheckCheck size={14} strokeWidth={2.2} />
              </span>
            ) : (
              <span className="inline-flex items-center opacity-85">
                <Check size={13} strokeWidth={2.2} />
              </span>
            ))}
        </div>

        {/* ── Action buttons (desktop) ──────────────────────────────── */}
        <div
          className={`mt-1.5 hidden flex-wrap items-center gap-1 sm:mt-2 sm:flex sm:gap-1.5 ${
            isOwnMessage ? "justify-end" : "justify-start"
          } ${isImageMessage ? "px-1" : ""}`}
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
          {/* Copy is not applicable for image messages */}
          {!message.isDeleted && !isImageMessage && (
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
