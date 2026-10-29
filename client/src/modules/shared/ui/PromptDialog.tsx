import React, { useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `datetime-local` gives a native picker, and a value like `2026-11-02T17:30`. */
  inputType?: "text" | "url" | "datetime-local";
  /** Returns an error message to keep the dialog open, or null when the value is fine. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/**
 * Text-entry stand-in for `window.prompt`. The form is a child that exists only
 * while the dialog is open, so it starts from `initialValue` every time and
 * needs no reset effect.
 */
export const PromptDialog: React.FC<PromptDialogProps> = ({ isOpen, onCancel, ...rest }) => (
  <Modal isOpen={isOpen} onClose={onCancel} size="sm" title={rest.title}>
    {isOpen && <PromptForm onCancel={onCancel} {...rest} />}
  </Modal>
);

const PromptForm: React.FC<Omit<PromptDialogProps, "isOpen">> = ({
  description,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  inputType = "text",
  validate,
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    const problem = validate ? validate(trimmed) : trimmed ? null : "This cannot be empty.";
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={submit}>
      {description && <p className="mb-4 text-sm text-slate-700">{description}</p>}
      <label className="block text-sm font-medium text-slate-800">
        {label ?? "Your answer"}
        <input
          autoFocus
          type={inputType}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </label>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit">{confirmLabel}</Button>
      </div>
    </form>
  );
};
