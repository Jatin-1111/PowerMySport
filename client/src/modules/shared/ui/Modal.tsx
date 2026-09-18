import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeButton?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
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
      previousFocusRef.current = document.activeElement as HTMLElement;

      setTimeout(() => {
        // Only grab focus on the modal container if nothing inside it already
        // has focus (e.g. an input with autoFocus). Otherwise we would steal
        // focus away, forcing the user to click the input again to type.
        const activeEl = document.activeElement;
        const insideModal = modalRef.current?.contains(activeEl);
        if (!insideModal) {
          modalRef.current?.focus();
        }
      }, 0);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (!isOpen && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Trap focus within modal
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  /**
   * Rendered into `document.body`, never where it was written.
   *
   * `position: fixed` is not as absolute as it looks: an ancestor with a
   * `transform`, a `filter` or a `backdrop-filter` becomes the containing block
   * for fixed descendants, and the overlay then anchors to that element instead
   * of the viewport. This codebase hits that constantly, because `.shop-surface`
   * — the class on most cards — is `backdrop-blur-md`, and those cards are
   * usually `overflow-hidden` too. A modal written inside one rendered as a
   * clipped sliver floating inside the card.
   *
   * Portalling makes the question moot: whatever the tree above looks like, the
   * overlay is a child of `body` and covers the viewport. It also fixes the
   * z-index arithmetic, since nothing above it can create a stacking context
   * that traps it.
   *
   * The `document` check is for the server pass. A modal is never open on first
   * paint — it opens from a click — so rendering nothing there matches what the
   * client produces, and no hydration mismatch is possible. Deliberately not a
   * `mounted` flag set in an effect: that is a setState in an effect body, which
   * this repo's lint rules reject, and it would cost every page an extra render.
   */
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop smoothly fades in/out */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal scales and slides up */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            onKeyDown={handleKeyDown}
            className={`relative z-10 flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl ${sizeClasses[size]}`}
          >
            {/* Header */}
            {(title || closeButton) && (
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                {title && (
                  <h2
                    id="modal-title"
                    className="text-lg font-semibold tracking-tight text-slate-900"
                  >
                    {title}
                  </h2>
                )}
                {!title && <div />}
                {closeButton && (
                  <button
                    onClick={onClose}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close modal"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
