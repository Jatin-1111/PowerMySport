import { motion } from "framer-motion";
import { Copy, RotateCcw, Pencil, Trash2 } from "lucide-react";
import type { ConversationMessage } from "@/modules/community/types";
import { isWithinMessageEditWindow } from "../../utils/chatUtils";

type MobileMessageActionsProps = {
  message: ConversationMessage;
  profileUserId?: string;
  onClose: () => void;
  onCopy: (message: ConversationMessage) => void;
  onRetry: (message: ConversationMessage) => void;
  onEdit: (message: ConversationMessage) => void;
  onDelete: (message: ConversationMessage) => void;
};

export function MobileMessageActions({
  message,
  profileUserId,
  onClose,
  onCopy,
  onRetry,
  onEdit,
  onDelete,
}: MobileMessageActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-end bg-slate-900/40 p-0 sm:hidden"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full rounded-t-3xl border-t border-slate-200 bg-white px-4 pb-8 pt-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Message options
        </p>

        <div className="mt-4 space-y-2.5">
          {!message.isDeleted && (
            <button
              onClick={() => {
                onCopy(message);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
            >
              <Copy size={18} className="text-slate-600" /> Copy message
            </button>
          )}

          {message.senderId === profileUserId &&
            message.messageStatus === "FAILED" && (
              <button
                onClick={() => {
                  onRetry(message);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
              >
                <RotateCcw size={18} className="text-slate-600" /> Retry sending
              </button>
            )}

          {message.senderId === profileUserId &&
            !message.isDeleted &&
            message.messageStatus !== "FAILED" && (
              <>
                <button
                  onClick={() => {
                    onEdit(message);
                    onClose();
                  }}
                  disabled={!isWithinMessageEditWindow(message.createdAt)}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Pencil size={18} className="text-slate-600" /> Edit message
                </button>
                <button
                  onClick={() => {
                    onDelete(message);
                    onClose();
                  }}
                  disabled={!isWithinMessageEditWindow(message.createdAt)}
                  className="flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-500 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 size={18} className="text-red-600" /> Delete message
                </button>
              </>
            )}
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-200"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}
