import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  loading = false,
}) => {
  const handleConfirm = () => {
    onConfirm();
    if (!loading) {
      onClose();
    }
  };

  const iconColors = {
    danger: "text-red-600",
    warning: "text-orange-600",
    info: "text-blue-600",
  };

  const confirmVariant = variant === "danger" ? "danger" : "primary";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title}>
      <div className="flex flex-col items-center text-center">
        <div className={`mb-4 ${iconColors[variant]}`}>
          <AlertTriangle size={48} />
        </div>
        <p className="text-slate-700 mb-6">{message}</p>
      </div>

      <div className="flex gap-3 justify-end mt-4">
        <Button onClick={onClose} variant="outline" disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant={confirmVariant}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
