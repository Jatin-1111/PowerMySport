"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bold,
  ClipboardPaste,
  Copy,
  Highlighter,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";

interface RichTextEditableProps {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const HIGHLIGHT_COLOR = "#FEF08A";

/**
 * A contentEditable rich-text field with a floating formatting toolbar that
 * appears above the current selection (bold / italic / underline / line-through
 * / highlight / copy / paste). Emits sanitized-on-render HTML via onChange.
 */
export default function RichTextEditable({
  html,
  onChange,
  placeholder,
  className = "",
}: RichTextEditableProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => setMounted(true), []);

  // Sync external value without clobbering the caret while the user is typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== (html || "")) {
      el.innerHTML = html || "";
    }
  }, [html]);

  const sync = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const updateToolbar = useCallback(() => {
    const el = ref.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setToolbar(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setToolbar(null);
      return;
    }
    setToolbar({ top: rect.top - 48, left: rect.left + rect.width / 2 });
  }, []);

  useEffect(() => {
    const handler = () => updateToolbar();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updateToolbar]);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    sync();
    updateToolbar();
  };

  const highlight = () => {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
      if (!document.execCommand("hiliteColor", false, HIGHLIGHT_COLOR)) {
        document.execCommand("backColor", false, HIGHLIGHT_COLOR);
      }
    } finally {
      document.execCommand("styleWithCSS", false, "false");
    }
    sync();
    updateToolbar();
  };

  const copySelection = async () => {
    const text = window.getSelection()?.toString() || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.execCommand("copy");
    }
  };

  const pasteSelection = async () => {
    ref.current?.focus();
    try {
      const text = await navigator.clipboard.readText();
      // Insert as plain text to keep the stored HTML clean.
      document.execCommand("insertText", false, text);
      sync();
    } catch {
      // Clipboard read blocked — user can use Ctrl/Cmd+V instead.
    }
  };

  const tools = [
    { label: "Bold", Icon: Bold, onClick: () => exec("bold") },
    { label: "Italic", Icon: Italic, onClick: () => exec("italic") },
    { label: "Underline", Icon: Underline, onClick: () => exec("underline") },
    {
      label: "Line-through",
      Icon: Strikethrough,
      onClick: () => exec("strikeThrough"),
    },
    { label: "Highlight", Icon: Highlighter, onClick: highlight },
    { label: "Copy", Icon: Copy, onClick: () => void copySelection() },
    { label: "Paste", Icon: ClipboardPaste, onClick: () => void pasteSelection() },
  ];

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={sync}
        onMouseUp={updateToolbar}
        onKeyUp={updateToolbar}
        onBlur={() => {
          // Let a toolbar click land first; then hide if selection collapsed.
          setTimeout(() => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) setToolbar(null);
          }, 150);
        }}
        className={`blog-rich w-full whitespace-pre-wrap break-words outline-none ${className}`}
      />

      {mounted ? (
        createPortal(
          <AnimatePresence>
            {toolbar ? (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: "fixed",
                  top: toolbar.top,
                  left: toolbar.left,
                  transform: "translateX(-50%)",
                  zIndex: 500,
                }}
                // Prevent the mousedown from clearing the text selection.
                onMouseDown={(event) => event.preventDefault()}
                className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/15"
              >
                {tools.map(({ label, Icon, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onClick}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      ) : null}
    </>
  );
}
