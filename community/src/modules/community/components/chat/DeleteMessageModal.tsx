import { motion } from "framer-motion";
import { Trash2, X } from "lucide-react";

interface DeleteMessageModalProps {
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteMessageModal({
  isDeleting,
  onClose,
  onConfirm,
}: DeleteMessageModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Delete Message
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>
        
        <p className="mt-4 text-sm text-slate-500 leading-relaxed">
          Are you sure you want to delete this message? This action cannot be undone.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
