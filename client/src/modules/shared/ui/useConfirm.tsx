"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
}

/**
 * Promise-based stand-in for `window.confirm`.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: "Delete address", message: "...", variant: "danger" }))) return;
 *   ...
 *   return <>...{confirmDialog}</>;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  // `options` outlives `open` so the text stays put while the modal animates out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  // ConfirmDialog calls onConfirm and then onClose; the first call wins because
  // the resolver is cleared as it settles, so the second is a no-op.
  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const dialog = (
    <ConfirmDialog
      isOpen={open}
      title={options?.title ?? ""}
      message={options?.message ?? ""}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      variant={options?.variant}
      onConfirm={() => settle(true)}
      onClose={() => settle(false)}
    />
  );

  return [confirm, dialog];
}
