"use client";

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

export default function RichTextCanvas({
  initialContent,
  onChange,
  placeholder = "Tell your story...",
}: RichTextCanvasProps) {
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
        class:
          "tiptap blog-prose min-h-[320px] px-4 py-4 outline-none sm:px-6",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="rounded-b-2xl" />
    </div>
  );
}
