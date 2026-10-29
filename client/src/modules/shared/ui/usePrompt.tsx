"use client";

import { useCallback, useRef, useState } from "react";
import { PromptDialog } from "./PromptDialog";

export interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: "text" | "url" | "datetime-local";
  validate?: (value: string) => string | null;
}

/**
 * Promise-based stand-in for `window.prompt`. Resolves to the trimmed text, or
 * null when the person cancels.
 *
 *   const [prompt, promptDialog] = usePrompt();
 *   const link = await prompt({ title: "Class link", inputType: "url" });
 *   if (!link) return;
 *   ...
 *   return <>...{promptDialog}</>;
 */
export function usePrompt(): [(options: PromptOptions) => Promise<string | null>, React.ReactNode] {
  // `options` outlives `open` so the text stays put while the modal animates out.
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const prompt = useCallback((next: PromptOptions) => {
    setOptions(next);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
  };

  const dialog = (
    <PromptDialog
      isOpen={open}
      title={options?.title ?? ""}
      description={options?.description}
      label={options?.label}
      placeholder={options?.placeholder}
      initialValue={options?.initialValue}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      inputType={options?.inputType}
      validate={options?.validate}
      onSubmit={(value) => settle(value)}
      onCancel={() => settle(null)}
    />
  );

  return [prompt, dialog];
}
