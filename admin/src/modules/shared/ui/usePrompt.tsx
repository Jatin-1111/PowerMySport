"use client";

import { useCallback, useRef, useState } from "react";
import { PromptModal } from "./PromptModal";

export interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  validate?: (value: string) => string | null;
}

/**
 * Promise-based stand-in for `window.prompt`. Resolves to the trimmed text, or
 * null when the person cancels.
 *
 *   const [prompt, promptDialog] = usePrompt();
 *   const reason = await prompt({ title: "Why reject this?", multiline: true });
 *   if (!reason) return;
 *   ...
 *   return <>...{promptDialog}</>;
 */
export function usePrompt(): [(options: PromptOptions) => Promise<string | null>, React.ReactNode] {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const prompt = useCallback((next: PromptOptions) => {
    setOptions(next);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const dialog = (
    <PromptModal
      open={options !== null}
      title={options?.title ?? ""}
      description={options?.description}
      label={options?.label}
      placeholder={options?.placeholder}
      initialValue={options?.initialValue}
      confirmLabel={options?.confirmLabel}
      cancelLabel={options?.cancelLabel}
      multiline={options?.multiline}
      validate={options?.validate}
      onSubmit={(value) => settle(value)}
      onCancel={() => settle(null)}
    />
  );

  return [prompt, dialog];
}
