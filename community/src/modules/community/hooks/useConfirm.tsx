"use client";

import ConfirmActionModal from "@/modules/community/components/chat/ConfirmActionModal";
import { useCallback, useRef, useState } from "react";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
}

/**
 * Promise-based stand-in for `window.confirm`, drawn with the community's own
 * ConfirmActionModal.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: "Delete?", description: "...", variant: "danger" }))) return;
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

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const dialog = (
    <ConfirmActionModal
      isOpen={open}
      title={options?.title ?? ""}
      description={options?.description ?? ""}
      confirmLabel={options?.confirmLabel}
      variant={options?.variant}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return [confirm, dialog];
}
