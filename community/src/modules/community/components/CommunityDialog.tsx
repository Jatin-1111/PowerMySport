"use client";

import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface CommunityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Serif heading. Pass `titleId` content through `title`; the dialog labels itself with it. */
  title: ReactNode;
  /** One quiet line under the title: sport, status, handle. */
  kicker?: ReactNode;
  /** Text actions that sit beside the close button (edit, delete). */
  headerActions?: ReactNode;
  children: ReactNode;
  /** Primary action area, pinned under the content. */
  footer?: ReactNode;
  maxWidthClassName?: string;
}

/**
 * The one dialog shell for community: paper surface, serif title, hairline
 * footer, bottom sheet on a phone. Escape and a click on the scrim close it.
 * Shared so the detail dialogs stop each carrying their own banner, avatar
 * overlap and shadow.
 */
export default function CommunityDialog({
  isOpen,
  onClose,
  title,
  kicker,
  headerActions,
  children,
  footer,
  maxWidthClassName = "max-w-lg",
}: CommunityDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bg-ink/50 fixed inset-0 z-[200]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 z-[201] flex items-end justify-center sm:items-center sm:p-6"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className={`bg-paper flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${maxWidthClassName}`}
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-7 sm:px-8 sm:pt-8">
                <div className="min-w-0">
                  {kicker ? <p className="text-ink-muted text-sm">{kicker}</p> : null}
                  <h2 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.08]">
                    {title}
                  </h2>
                </div>
                <div className="-mr-2 -mt-2 flex shrink-0 items-center gap-1">
                  {headerActions}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-ink-body hover:bg-paper-deep hover:text-ink flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200"
                  >
                    <X size={20} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto px-6 py-6 sm:px-8">{children}</div>

              {footer ? (
                <div className="border-hairline border-t px-6 py-5 sm:px-8">{footer}</div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
