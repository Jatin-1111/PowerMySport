import { useState } from "react";
import { motion } from "framer-motion";
import { Flag, X } from "lucide-react";

interface ReportModalProps {
  targetType: "MESSAGE" | "GROUP";
  targetId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
}

export function ReportModal({
  targetType,
  isSubmitting,
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-red-500" />
            <h3 className="text-base font-semibold text-slate-900">
              Report {targetType === "GROUP" ? "Group" : "Message"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border p-1.5 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
            >
              <option value="">Select a reason</option>
              <option value="Spam">Spam</option>
              <option value="Harassment">Harassment</option>
              <option value="Hate speech">Hate speech</option>
              <option value="Inappropriate content">
                Inappropriate content
              </option>
              <option value="Fake information">Fake information</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Additional details (optional)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason, details)}
            disabled={isSubmitting || !reason}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
