"use client";

// ─── Pathway editor fields ───────────────────────────────────────────────────
//
// The small pieces the stage editor is built from. They exist as their own file
// because the pathway format is four repeatable lists with slightly different
// row shapes, and writing add/remove/move plumbing four times is how those four
// lists slowly stop behaving the same way as each other.
//
// Everything here is uncontrolled-by-convention: value in, onChange out. No
// component reaches for the guide, so a stage form can be rendered against a
// draft that has not been saved yet.

import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

// ─── Primitives ──────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none";

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} leading-relaxed`}
    />
  );
}

// ─── Repeatable list ─────────────────────────────────────────────────────────

/**
 * A list of rows with add / remove / move-up / move-down.
 *
 * `renderRow` gets the item and a setter for that item alone, so a row never has
 * to know its own index or rebuild the array — which is where off-by-one bugs in
 * hand-rolled versions of this always come from.
 */
export function RepeatableList<T>({
  label,
  hint,
  items,
  onChange,
  makeEmpty,
  renderRow,
  addLabel = "Add",
  emptyText = "Nothing here yet.",
}: {
  label: string;
  hint?: string;
  items: T[];
  onChange: (next: T[]) => void;
  makeEmpty: () => T;
  renderRow: (item: T, set: (next: T) => void) => ReactNode;
  addLabel?: string;
  emptyText?: string;
}) {
  const replace = (index: number, next: T) =>
    onChange(items.map((item, i) => (i === index ? next : item)));

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved as T);
    onChange(next);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{label}</h3>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400 italic">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-col items-center gap-0.5 pt-1 text-slate-300">
                <GripVertical className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold text-slate-400">{index + 1}</span>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {renderRow(item, (next) => replace(index, next))}
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Remove" danger onClick={() => remove(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onChange([...items, makeEmpty()])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded border border-slate-200 p-1 text-slate-400 disabled:opacity-30 ${
        danger
          ? "hover:border-red-300 hover:text-red-600"
          : "hover:border-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Validation display ──────────────────────────────────────────────────────

/**
 * The server's pathed errors, shown as-is.
 *
 * They arrive as `stages[2].questions[0].question: too small` and are NOT
 * prettified into a friendlier sentence: the path is the only thing that tells
 * an author which of forty fields on this page is the broken one.
 */
export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-bold text-red-800">
        {errors.length} problem{errors.length === 1 ? "" : "s"} to fix
      </p>
      <ul className="mt-1.5 space-y-1 font-mono text-xs text-red-900">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
