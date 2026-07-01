"use client";

import { useEffect, useRef } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { BlogBlock, BlogBlockType } from "@/modules/community/types";
import AddBlockMenu from "./AddBlockMenu";
import BlockActionsMenu from "./BlockActionsMenu";
import ImageBlockUploader from "./ImageBlockUploader";
import RichTextEditable from "./RichTextEditable";
import { convertBlock, isBlockEmpty } from "./blockUtils";

interface EditorBlockProps {
  block: BlogBlock;
  onChange: (block: BlogBlock) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

const HEADING_LEVELS: Array<1 | 2 | 3> = [1, 2, 3];

/** Auto-growing textarea shared by text/quote blocks. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
  rows = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Size to content on mount and whenever the value changes externally
  // (e.g. loading an existing blog in edit mode).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      onChange={(event) => {
        onChange(event.target.value);
        event.target.style.height = "auto";
        event.target.style.height = `${event.target.scrollHeight}px`;
      }}
      placeholder={placeholder}
      className={`w-full resize-none bg-transparent outline-none placeholder:text-slate-300 ${className}`}
    />
  );
}

export default function EditorBlock({
  block,
  onChange,
  onDuplicate,
  onCopy,
  onDelete,
}: EditorBlockProps) {
  const dragControls = useDragControls();
  const empty = isBlockEmpty(block);
  const changeType = (type: BlogBlockType) => onChange(convertBlock(block, type));

  const renderEditor = () => {
    switch (block.type) {
      case "heading": {
        const level = block.level || 2;
        const sizeCls =
          level === 1 ? "text-2xl" : level === 3 ? "text-lg" : "text-xl";
        return (
          <div className="flex items-start gap-2">
            <div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-200">
              {HEADING_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onChange({ ...block, level: lvl })}
                  className={`px-1.5 py-0.5 text-[10px] font-bold transition ${
                    level === lvl
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
            <RichTextEditable
              html={block.text || ""}
              onChange={(text) => onChange({ ...block, text })}
              placeholder="Heading"
              className={`font-title font-bold leading-tight text-slate-900 ${sizeCls}`}
            />
          </div>
        );
      }

      case "quote":
        return (
          <div className="border-l-4 border-power-orange/50 pl-4">
            <RichTextEditable
              html={block.text || ""}
              onChange={(text) => onChange({ ...block, text })}
              placeholder="Quote..."
              className="text-base italic leading-relaxed text-slate-700"
            />
          </div>
        );

      case "list":
        return (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onChange({ ...block, ordered: !block.ordered })}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              {block.ordered ? "1. Numbered" : "• Bulleted"}
            </button>
            <AutoTextarea
              value={(block.items || []).join("\n")}
              rows={2}
              onChange={(value) =>
                onChange({ ...block, items: value.split("\n") })
              }
              placeholder={"One item per line\nSecond item"}
              className="text-base leading-relaxed text-slate-700"
            />
          </div>
        );

      case "image":
        return (
          <div className="space-y-2">
            <ImageBlockUploader
              imageUrl={block.imageUrl}
              onUploaded={(key, url) =>
                onChange({ ...block, imageKey: key, imageUrl: url })
              }
              onRemove={() => onChange({ ...block, imageKey: "", imageUrl: "" })}
              className="aspect-[16/9]"
              label="Add an image to your story"
            />
            <input
              value={block.caption || ""}
              onChange={(event) =>
                onChange({ ...block, caption: event.target.value })
              }
              placeholder="Add a caption (optional)"
              className="w-full bg-transparent text-center text-xs text-slate-500 outline-none placeholder:text-slate-300"
            />
          </div>
        );

      case "text":
      default:
        return (
          <RichTextEditable
            html={block.text || ""}
            onChange={(text) => onChange({ ...block, text })}
            placeholder="Write something..."
            className="text-base leading-relaxed text-slate-700"
          />
        );
    }
  };

  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={dragControls}
      className="group relative rounded-xl"
    >
      <div className="flex items-start gap-1">
        {/* Left gutter control — one icon per line, adjacent to the content */}
        <div className="flex shrink-0 items-center pt-1">
          {empty ? (
            // Empty line → "+" picks what this line becomes.
            <AddBlockMenu onAdd={changeType} />
          ) : (
            // Filled line → six-dot grid: drag + turn-into + duplicate/copy/delete.
            <BlockActionsMenu
              onChangeType={changeType}
              onDuplicate={onDuplicate}
              onCopy={onCopy}
              onDelete={onDelete}
              onDragPointerDown={(event) => dragControls.start(event)}
            />
          )}
        </div>

        {/* Block content */}
        <div className="min-w-0 flex-1 rounded-xl px-2 py-1.5 transition group-hover:bg-slate-50/60">
          {renderEditor()}
        </div>
      </div>
    </Reorder.Item>
  );
}
