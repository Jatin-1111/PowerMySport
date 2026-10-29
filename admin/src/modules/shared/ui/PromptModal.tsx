import { useEffect, useState } from "react";

interface PromptModalProps {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Multi-line answer, for a reason or a note. */
  multiline?: boolean;
  /** Returns an error message to keep the dialog open, or null when the value is fine. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/**
 * Text-entry stand-in for `window.prompt`. Mounted only while open, so the
 * field always starts from `initialValue` and takes focus on its own.
 */
export function PromptModal({ open, ...rest }: PromptModalProps) {
  if (!open) return null;
  return <PromptBody {...rest} />;
}

function PromptBody({
  title,
  description,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  multiline = false,
  validate,
  onSubmit,
  onCancel,
}: Omit<PromptModalProps, "open">) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const submit = () => {
    const trimmed = value.trim();
    const problem = validate ? validate(trimmed) : trimmed ? null : "This cannot be empty.";
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(trimmed);
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-2 text-sm text-slate-600">{description}</p>}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          {label ?? "Your answer"}
          {multiline ? (
            <textarea
              autoFocus
              rows={4}
              value={value}
              placeholder={placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              className={fieldClass}
            />
          ) : (
            <input
              autoFocus
              type="text"
              value={value}
              placeholder={placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              className={fieldClass}
            />
          )}
        </label>
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
