import { useState } from "react";
import CommunityDialog from "@/modules/community/components/CommunityDialog";

interface ReportModalProps {
  targetType: "MESSAGE" | "GROUP" | "EXPERIENCE";
  targetId: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
}

const TARGET_LABELS: Record<ReportModalProps["targetType"], string> = {
  GROUP: "group",
  MESSAGE: "message",
  EXPERIENCE: "experience",
};

const REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Inappropriate content",
  "Fake information",
  "Other",
];

const fieldCls =
  "text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink w-full rounded-md border border-[#d9d3c8] bg-white px-4 text-base transition-colors duration-200 focus:outline-none";

export function ReportModal({ targetType, isSubmitting, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  return (
    <CommunityDialog
      isOpen
      onClose={onClose}
      title={`Report this ${TARGET_LABELS[targetType]}`}
      kicker="Moderators review every report"
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
          <button
            type="button"
            onClick={onClose}
            className="text-ink decoration-ink/30 hover:decoration-ink min-h-11 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason, details)}
            disabled={isSubmitting || !reason}
            className="btn-motion min-h-12 rounded-md bg-red-700 px-7 text-base font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {isSubmitting ? "Sending" : "Send report"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label htmlFor="report-reason" className="text-ink mb-2 block text-base font-semibold">
            Reason
          </label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${fieldCls} h-12`}
          >
            <option value="">Select a reason</option>
            {REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="report-details" className="text-ink mb-2 block text-base font-semibold">
            Anything else we should know?
          </label>
          <textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Optional. Add context that helps a moderator decide."
            rows={3}
            className={`${fieldCls} resize-none py-3 leading-relaxed`}
          />
        </div>
      </div>
    </CommunityDialog>
  );
}
