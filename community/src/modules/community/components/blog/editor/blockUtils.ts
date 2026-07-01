import { BlogBlock, BlogBlockType } from "@/modules/community/types";

export const genBlockId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

export const createBlock = (type: BlogBlockType): BlogBlock => {
  const base = { id: genBlockId(), type };
  switch (type) {
    case "heading":
      return { ...base, text: "", level: 2 };
    case "list":
      return { ...base, items: [""], ordered: false };
    case "image":
      return { ...base, imageKey: "", caption: "" };
    case "quote":
    case "text":
    default:
      return { ...base, text: "" };
  }
};

/**
 * Convert a block to a different type, preserving text content where it makes
 * sense (used by the "+" picker on empty lines and the grid "Turn into" menu).
 */
export const convertBlock = (
  block: BlogBlock,
  type: BlogBlockType,
): BlogBlock => {
  if (block.type === type) return block;

  const base = { ...createBlock(type), id: block.id };
  const sourceText =
    block.type === "list"
      ? (block.items || []).join("\n")
      : block.text || "";

  if (type === "list") {
    base.items = sourceText ? sourceText.split("\n") : [""];
  } else if (type === "image") {
    if (block.type === "image") {
      base.imageKey = block.imageKey;
      base.imageUrl = block.imageUrl;
      base.caption = block.caption;
    }
  } else {
    base.text = sourceText;
  }
  return base;
};

export const duplicateBlock = (block: BlogBlock): BlogBlock => ({
  ...block,
  id: genBlockId(),
  items: Array.isArray(block.items) ? [...block.items] : block.items,
});

/** Plain-text representation of a block for the "copy" action. */
export const blockToText = (block: BlogBlock): string => {
  switch (block.type) {
    case "list":
      return (block.items || []).join("\n");
    case "image":
      return block.caption || "";
    default:
      return block.text || "";
  }
};

/** Strip HTML tags/entities to test whether rich text is actually empty. */
const richTextIsEmpty = (html?: string): boolean =>
  !(html || "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

/** True when a block has no meaningful content (used to prune on publish). */
export const isBlockEmpty = (block: BlogBlock): boolean => {
  switch (block.type) {
    case "list":
      return !(block.items || []).some((item) => item.trim().length > 0);
    case "image":
      return !block.imageKey;
    default:
      return richTextIsEmpty(block.text);
  }
};
