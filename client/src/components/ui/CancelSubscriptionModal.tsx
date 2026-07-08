import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isLoading: boolean;
}

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: CancelModalProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason.trim() || "User cancelled without providing a reason");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Subscription">
      <div className="space-y-6 p-2 sm:p-4">
        {/* Sleek Warning Banner matching your theme */}
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-4 text-rose-800 border border-rose-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <p className="text-sm">
            <strong>Are you sure?</strong> You will lose access to all coach
            content and sessions at the end of your current billing cycle.
          </p>
        </div>

        {/* Input Section with premium styling */}
        <div className="space-y-3">
          <label
            htmlFor="reason"
            className="text-sm font-semibold text-slate-900"
          >
            Help us improve (Optional)
          </label>
          <Textarea
            id="reason"
            placeholder="Tell us why you're leaving..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full resize-none rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
            rows={3}
            disabled={isLoading}
          />
        </div>

        {/* Action Buttons - Mobile responsive stack, Desktop right-align */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            className="w-full sm:w-auto text-slate-700"
            onClick={onClose}
            disabled={isLoading}
          >
            Keep Subscription
          </Button>
          <Button
            variant="danger"
            className="w-full sm:w-auto border-2 border-slate-100"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Cancelling..." : "Confirm Cancellation"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
