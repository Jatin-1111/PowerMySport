import { X } from "lucide-react";
import React, { useEffect, useRef } from "react";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Store currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 0);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      // Restore focus when modal closes
      if (!isOpen && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Trap focus within modal
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

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
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        onKeyDown={handleKeyDown}
        className={`relative z-10 w-full rounded-lg bg-white shadow-xl ${sizeClasses[size]}`}
      >
        {/* Header */}
        {(title || closeButton) && (
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            {title && (
              <h2 id="modal-title" className="text-lg font-bold text-slate-900">
                {title}
              </h2>
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
