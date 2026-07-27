"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { BlogImage } from "./BlogImageExtension";
import EditorToolbar from "./EditorToolbar";

interface RichTextCanvasProps {
  initialContent: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const AVERAGE_READING_WPM = 200;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function RichTextCanvas({
  initialContent,
  onChange,
  placeholder = "Tell your story...",
}: RichTextCanvasProps) {
  const [wordCount, setWordCount] = useState(() => countWords(""));

  const editor = useEditor({
    immediatelyRender: false,
    // Toolbar button active-states (bold/heading/align...) need a re-render
    // on every selection/content change, which Tiptap v3 no longer does by
    // default.
    shouldRerenderOnTransaction: true,
    content: initialContent,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      BlogImage.configure({ HTMLAttributes: { class: "blog-content-image" } }),
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        class: "tiptap blog-prose min-h-[320px] px-4 py-4 outline-none sm:px-6",
      },
    },
    onCreate: ({ editor: instance }) => setWordCount(countWords(instance.getText())),
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
      setWordCount(countWords(instance.getText()));
    },
  });

  const readTimeMin = Math.max(1, Math.round(wordCount / AVERAGE_READING_WPM));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex items-center justify-end border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:px-6">
        {wordCount} {wordCount === 1 ? "word" : "words"} · {readTimeMin} min read
      </div>
    </div>
  );
}
