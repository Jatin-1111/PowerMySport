"use client";

import { useEffect } from "react";
import { Reorder } from "framer-motion";
import { BlogBlock } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import EditorBlock from "./EditorBlock";
import {
  blockToText,
  createBlock,
  duplicateBlock,
  isBlockEmpty,
} from "./blockUtils";

interface BlockEditorProps {
  blocks: BlogBlock[];
  onChange: (blocks: BlogBlock[]) => void;
}

export default function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  // Always keep a trailing empty line so a "+" is available on the next line.
  useEffect(() => {
    if (blocks.length === 0) {
      onChange([createBlock("text")]);
      return;
    }
    const last = blocks[blocks.length - 1];
    if (!isBlockEmpty(last)) {
      onChange([...blocks, createBlock("text")]);
    }
  }, [blocks, onChange]);

  const updateBlock = (id: string, next: BlogBlock) => {
    onChange(blocks.map((block) => (block.id === id ? next : block)));
  };

  const duplicateAt = (index: number) => {
    const next = [...blocks];
    next.splice(index + 1, 0, duplicateBlock(blocks[index]));
    onChange(next);
  };

  const copyAt = async (index: number) => {
    try {
      await navigator.clipboard.writeText(blockToText(blocks[index]));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const deleteAt = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  return (
    <Reorder.Group
      axis="y"
      values={blocks}
      onReorder={onChange}
      className="space-y-1"
    >
      {blocks.map((block, index) => (
        <EditorBlock
          key={block.id}
          block={block}
          onChange={(next) => updateBlock(block.id, next)}
          onDuplicate={() => duplicateAt(index)}
          onCopy={() => void copyAt(index)}
          onDelete={() => deleteAt(index)}
        />
      ))}
    </Reorder.Group>
  );
}
