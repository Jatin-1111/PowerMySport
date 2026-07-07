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
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end bg-slate-900/40 backdrop-blur-sm p-0 sm:hidden"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full rounded-t-[32px] border-t border-white/60 bg-white/80 backdrop-blur-2xl px-5 pb-8 pt-4 shadow-[0_-8px_40px_rgba(0,0,0,0.12)] supports-[backdrop-filter]:bg-white/70"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-300/80 shadow-inner" />

        <p className="text-[13px] font-bold uppercase tracking-widest text-slate-400 mb-1">
          Message Options
        </p>

        <div className="mt-4 space-y-3">
          {!message.isDeleted && (
            <button
              onClick={() => {
                onCopy(message);
                onClose();
              }}
              className="flex w-full items-center gap-3.5 rounded-2xl bg-white/60 px-5 py-3.5 text-[15px] font-600 text-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] transition hover:bg-white active:scale-[0.98]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Copy size={18} strokeWidth={2.5} />
              </div>
              Copy message
            </button>
          )}

          {message.senderId === profileUserId &&
            message.messageStatus === "FAILED" && (
              <button
                onClick={() => {
                  onRetry(message);
                  onClose();
                }}
                className="flex w-full items-center gap-3.5 rounded-2xl bg-white/60 px-5 py-3.5 text-[15px] font-600 text-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] transition hover:bg-white active:scale-[0.98]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-power-orange">
                  <RotateCcw size={18} strokeWidth={2.5} />
                </div>
                Retry sending
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
                  className="flex w-full items-center gap-3.5 rounded-2xl bg-white/60 px-5 py-3.5 text-[15px] font-600 text-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] transition hover:bg-white active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <Pencil size={18} strokeWidth={2.5} />
                  </div>
                  Edit message
                </button>
                <button
                  onClick={() => {
                    onDelete(message);
                    onClose();
                  }}
                  disabled={!isWithinMessageEditWindow(message.createdAt)}
                  className="flex w-full items-center gap-3.5 rounded-2xl bg-red-50/80 px-5 py-3.5 text-[15px] font-600 text-red-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.02)] transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100/80 text-red-600">
                    <Trash2 size={18} strokeWidth={2.5} />
                  </div>
                  Delete message
                </button>
              </>
            )}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-slate-200/60 px-4 py-4 text-[15px] font-bold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}
