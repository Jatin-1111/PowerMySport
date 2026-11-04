// ─── Text written in a word processor, shown as formatted text ──────────────
//
// Long answers (a point system, the steps to register, the difference between
// two tournament categories) are authored by pasting from Word or Google Docs,
// so what is stored is plain text carrying the author's formatting as
// characters: blank lines between paragraphs, "1." for steps, "-" or "•" for
// bullets. Drawn as a single text node a browser collapses every one of those
// line breaks into a space, and a point system reads as one wall of words.
//
// So this text is read as Markdown. Markdown is the right thing to store
// because it is still plain text: nothing in it can run, it reads sensibly
// anywhere (the roadmap chat is given it as it stands), and an editor can be
// swapped later without migrating a word. The two pieces here make existing
// pasted text work as Markdown without anyone re-typing it.

/**
 * Word and Docs paste artefacts that Markdown would not understand, rewritten
 * as what the author meant.
 *
 * - "•\tDivision I" (a bullet character and a tab) becomes "- Division I".
 * - Non-breaking spaces become spaces, CRLF becomes LF.
 * - Trailing spaces go: two of them are a Markdown hard break, and a pasted
 *   line often ends in one by accident.
 */
export function normalizeRichText(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/^[ \t]*[•◦▪▫‣⁃·][ \t]*/gm, "- ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/** The little of the Markdown syntax tree this file touches. */
interface SyntaxNode {
  type: string;
  value?: string;
  children?: SyntaxNode[];
}

function breakLines(node: SyntaxNode): void {
  if (!node.children) return;
  const next: SyntaxNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value?.includes("\n")) {
      child.value.split("\n").forEach((part, index) => {
        if (index > 0) next.push({ type: "break" });
        if (part) next.push({ type: "text", value: part });
      });
    } else {
      breakLines(child);
      next.push(child);
    }
  }
  node.children = next;
}

/**
 * A Markdown plugin that keeps a single line break as a line break.
 *
 * Markdown joins "Winner: 10 Points" and the line under it into one line, which
 * is right for prose and wrong for a pasted list of results, where each line is
 * its own item. Everything this text is pasted from treats a line break as a
 * line break, so this does too. A blank line still starts a new paragraph.
 *
 * Written here instead of pulling in remark-breaks: it is a dozen lines.
 */
export function remarkKeepLineBreaks() {
  return (tree: unknown) => breakLines(tree as SyntaxNode);
}
