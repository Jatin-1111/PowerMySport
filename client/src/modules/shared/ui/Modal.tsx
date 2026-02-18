import { X } from "lucide-react";
import React from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  closeButton?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeButton = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full rounded-lg bg-white shadow-xl ${sizeClasses[size]}`}
      >
        {/* Header */}
        {(title || closeButton) && (
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            {title && (
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            )}
            {!title && <div />}
            {closeButton && (
              <button
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-slate-100"
                aria-label="Close modal"
              >
                <X size={20} className="text-slate-500" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-slate-200 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
};
