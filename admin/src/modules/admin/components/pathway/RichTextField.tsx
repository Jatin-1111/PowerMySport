"use client";

// ─── A text box for formatted pathway text ──────────────────────────────────
//
// Answers, overviews and details are formatted text: paragraphs, lists, bold,
// a table for a point system. This is the box they are written in, built for
// someone who has never seen Markdown and pastes from Word:
//
//   - Pasting carries the formatting over. Bullets, numbering, bold and tables
//     copied from Word or Google Docs arrive as the real thing, not as
//     "•<tab>" characters (see cleanPastedContent).
//   - A toolbar writes the syntax for them: bold, heading, bullets, numbers, a
//     table. Someone who does know the syntax can just type it.
//   - A Preview tab shows the text exactly as parents will see it. It uses the
//     same renderer as the website, from the same package, so the two cannot
//     disagree.
//
// What is stored is still Markdown in a plain text field. Nothing about this
// box changes the data, so a better editor can replace it later without a
// migration.

import {
  RichText,
  cleanPastedContent,
  insertTable,
  tidyAll,
  toggleBold,
  toggleBulletList,
  toggleHeading,
  toggleNumberedList,
  type TextEdit,
} from "@powermysport/rich-text";
import { Bold, Eye, Heading, List, ListOrdered, Pencil, Sparkles, Table } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none";

const PASTE_NOTES = {
  html: "Kept the formatting from your paste: lists, bold and tables.",
  table: "Turned the pasted rows into a table.",
  text: "Tidied the pasted bullets.",
} as const;

function ToolbarButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500"
    >
      {children}
    </button>
  );
}

export function RichTextField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  previewSize = "detail",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** The server's limit for this field. Shown as a count; the server is what enforces it. */
  maxLength?: number;
  /** Which size the website uses for this field, so the preview matches. */
  previewSize?: "body" | "detail";
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const helpId = useId();

  /**
   * Replace part of the text and select what the edit says to.
   *
   * Goes through execCommand so the browser's own undo keeps working: a
   * toolbar button or a cleaned paste can be undone with Ctrl+Z like typing.
   * Setting `value` would be simpler and would wipe the undo history.
   */
  const apply = (edit: TextEdit) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(edit.start, edit.end);
    const done =
      typeof document.execCommand === "function" &&
      document.execCommand("insertText", false, edit.text);
    if (!done) {
      el.setRangeText(edit.text, edit.start, edit.end, "end");
      onChange(el.value);
    }
    el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  };

  const run = (action: (text: string, start: number, end: number) => TextEdit) => {
    const el = textareaRef.current;
    if (el) apply(action(el.value, el.selectionStart, el.selectionEnd));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const result = cleanPastedContent({
      html: event.clipboardData.getData("text/html"),
      text: event.clipboardData.getData("text/plain"),
    });
    // Plain text that needs no tidying pastes natively, exactly as before.
    if (!result.changed) return;
    event.preventDefault();
    const el = event.currentTarget;
    apply({
      start: el.selectionStart,
      end: el.selectionEnd,
      text: result.text,
      selectionStart: el.selectionStart + result.text.length,
      selectionEnd: el.selectionStart + result.text.length,
    });
    // After the insert, whose change event clears any older note.
    setPasteNote(PASTE_NOTES[result.source]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      run(toggleBold);
    }
  };

  const count = value.length;
  const nearLimit = maxLength !== undefined && count >= maxLength * 0.9;
  const overLimit = maxLength !== undefined && count > maxLength;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-1.5 py-1">
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
          {mode === "write" ? (
            <>
              <ToolbarButton label="Bold" shortcut="Ctrl+B" onClick={() => run(toggleBold)}>
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Heading" onClick={() => run(toggleHeading)}>
                <Heading className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Bulleted list" onClick={() => run(toggleBulletList)}>
                <List className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Numbered list" onClick={() => run(toggleNumberedList)}>
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton label="Insert a table" onClick={() => run(insertTable)}>
                <Table className="h-4 w-4" />
              </ToolbarButton>
              <span aria-hidden className="mx-1 h-4 w-px bg-slate-300" />
              <ToolbarButton
                label="Tidy the whole text: turn Word bullets into list items"
                onClick={() => run((text) => tidyAll(text))}
              >
                <Sparkles className="h-4 w-4" />
                Tidy
              </ToolbarButton>
            </>
          ) : (
            <span className="px-2 text-xs font-semibold text-slate-600">
              This is how parents will see it
            </span>
          )}
        </div>

        <div role="tablist" aria-label="Write or preview" className="flex gap-0.5">
          {(
            [
              ["write", "Write", Pencil],
              ["preview", "Preview", Eye],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-500 ${
                mode === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          rows={rows}
          placeholder={placeholder}
          aria-describedby={helpId}
          onChange={(event) => {
            setPasteNote(null);
            onChange(event.target.value);
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          className={inputClass}
        />
      ) : (
        <div
          aria-live="polite"
          className="min-h-[5.5rem] rounded-lg border border-slate-200 bg-white p-3.5"
        >
          {value.trim() ? (
            <RichText size={previewSize}>{value}</RichText>
          ) : (
            <p className="text-sm italic text-slate-500">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <div id={helpId} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-slate-500">
          {pasteNote ? (
            <span className="font-semibold text-emerald-700">{pasteNote} Ctrl+Z undoes it.</span>
          ) : (
            "Paste from Word or Google Docs: bullets, bold and tables carry over."
          )}
        </p>
        {maxLength !== undefined && (
          <p
            className={`text-xs tabular-nums ${
              overLimit
                ? "font-bold text-red-700"
                : nearLimit
                  ? "font-semibold text-amber-700"
                  : "text-slate-500"
            }`}
          >
            {count.toLocaleString()} / {maxLength.toLocaleString()}
            {overLimit && " (too long to save)"}
          </p>
        )}
      </div>

      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold hover:text-slate-900">
          Formatting help
        </summary>
        <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <li>
            <code className="rounded bg-slate-100 px-1">**bold**</code> makes text bold
          </li>
          <li>
            <code className="rounded bg-slate-100 px-1">- item</code> starts a bullet
          </li>
          <li>
            <code className="rounded bg-slate-100 px-1">1. item</code> starts a numbered step
          </li>
          <li>
            <code className="rounded bg-slate-100 px-1">### Title</code> makes a heading
          </li>
          <li>A blank line starts a new paragraph</li>
          <li>A line break on its own stays a line break</li>
        </ul>
      </details>
    </div>
  );
}
