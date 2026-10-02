import { normalizeRichText } from "./normalize";

// ─── Pasting from Word or Google Docs ───────────────────────────────────────
//
// What an editor copies from a document is not the text they see. The
// clipboard carries a plain version, where a bullet is a bullet character and
// a tab, and an HTML version that still knows what was a list, what was bold
// and what was a table. Pasting the plain version into a text box is how
// "•\tDivision I" ended up in the stored answers.
//
// So a paste is read from the HTML version when there is one worth reading, and
// turned into the Markdown that RichText draws: lists become lists, bold stays
// bold, a table becomes a table. The two sources behave very differently, and
// both are handled:
//
// - Google Docs wraps everything in a <b style="font-weight:normal">, marks bold
//   with inline styles rather than <b>, and uses real <ul>/<ol>.
// - Word (desktop) does not use <ul>/<ol> at all: a list item is a paragraph
//   with an "mso-list" style and a leading marker span that has to be read to
//   tell a bullet from a number, and the nesting depth is in the style too.
//
// The output is plain text going into a text box, never HTML, so nothing here
// can inject markup; the work is entirely about recovering structure.

/** A paste larger than this is not a paragraph or two of answer text. */
const MAX_HTML_LENGTH = 400_000;

const IGNORED_TAGS = new Set([
  "STYLE",
  "SCRIPT",
  "HEAD",
  "TITLE",
  "META",
  "LINK",
  "XML",
  "NOSCRIPT",
  "TEMPLATE",
]);
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const LIST_TAGS = new Set(["UL", "OL"]);
const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "ASIDE",
  "FIGURE",
  "FIGCAPTION",
  "FORM",
  "PRE",
  "ADDRESS",
  "BLOCKQUOTE",
  "TABLE",
  "HR",
]);

const isElement = (node: Node): node is HTMLElement => node.nodeType === 1;
const isText = (node: Node): node is Text => node.nodeType === 3;

const styleOf = (el: HTMLElement) => (el.getAttribute("style") ?? "").toLowerCase();

/** Word's marker span: it holds the bullet or number, and is not part of the text. */
const isWordMarker = (el: HTMLElement) => /mso-list:\s*ignore/.test(styleOf(el));

function isWordListParagraph(el: HTMLElement): boolean {
  if (el.tagName !== "P") return false;
  const style = styleOf(el);
  return (
    /mso-list:\s*(?!none)\S/.test(style) || /(^|\s)MsoList/.test(el.getAttribute("class") ?? "")
  );
}

function isBold(el: HTMLElement): boolean {
  const weight = /font-weight:\s*([a-z0-9]+)/.exec(styleOf(el))?.[1];
  if (weight) return weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  // <b> with no weight in its style. Google Docs' own wrapper says "normal".
  return el.tagName === "B" || el.tagName === "STRONG";
}

function isItalic(el: HTMLElement): boolean {
  if (/font-style:\s*italic/.test(styleOf(el))) return true;
  if (/font-style:\s*normal/.test(styleOf(el))) return false;
  return el.tagName === "I" || el.tagName === "EM";
}

/** True when anything inside is a block, so the element must be walked as a container. */
function containsBlock(el: HTMLElement): boolean {
  return Boolean(
    el.querySelector("p,div,ul,ol,table,h1,h2,h3,h4,h5,h6,blockquote,pre,section,article,li")
  );
}

// ─── Inline text ─────────────────────────────────────────────────────────────

/** Wrap in a Markdown marker without letting the marker swallow the spaces around it. */
function wrap(text: string, marker: string): string {
  const core = text.trim();
  if (!core) return text;
  const lead = text.slice(0, text.length - text.trimStart().length);
  const trail = text.slice(text.trimEnd().length);
  return `${lead}${marker}${core}${marker}${trail}`;
}

/** Google wraps every link in a redirect; the address people mean is in `q`. */
function realHref(href: string): string | null {
  try {
    const url = new URL(href);
    if (/(^|\.)google\.com$/.test(url.hostname) && url.pathname === "/url") {
      const target = url.searchParams.get("q");
      if (target) return realHref(target);
    }
    return /^(https?:|mailto:)/i.test(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

function inline(node: Node, inBold = false, inItalic = false): string {
  if (isText(node)) {
    // Whitespace runs (including non-breaking spaces) are one space, as a browser
    // would draw them. A literal * would otherwise start emphasis.
    return (node.nodeValue ?? "").replace(/[\s ]+/g, " ").replace(/\*/g, "\\*");
  }
  if (!isElement(node)) return "";
  if (IGNORED_TAGS.has(node.tagName) || isWordMarker(node)) return "";
  if (node.tagName === "BR") return "\n";

  const bold = isBold(node);
  const italic = isItalic(node);
  const nextBold = inBold || bold;
  const nextItalic = inItalic || italic;

  let text = Array.from(node.childNodes)
    .map((child) => inline(child, nextBold, nextItalic))
    .join("");

  if (node.tagName === "A") {
    const href = realHref(node.getAttribute("href") ?? "");
    const label = text.trim();
    if (href && label) text = `[${label}](${href})`;
  }
  // Only the outermost element of a run adds the marker, so bold inside bold
  // is not "****".
  if (bold && !inBold) text = wrap(text, "**");
  if (italic && !inItalic && !bold) text = wrap(text, "*");
  return text;
}

/** An element's text as one line, however it is nested. */
function flat(el: HTMLElement, plain = false): string {
  return inline(el, plain, plain)
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

function tableToMarkdown(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr")).filter(
    (row) => row.closest("table") === table
  );
  const cells = rows.map((row, index) =>
    Array.from(row.children)
      .filter((cell) => cell.tagName === "TD" || cell.tagName === "TH")
      // A header is already set apart by the table, and Word and Docs bold it
      // as well, so bold there would only be noise.
      .map((cell) => flat(cell as HTMLElement, index === 0).replace(/\|/g, "\\|"))
  );
  const width = Math.max(0, ...cells.map((row) => row.length));
  if (width === 0 || cells.length === 0) return "";
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => row[i] || " ").join(" | ")} |`;
  const [head, ...body] = cells;
  return [
    line(head!),
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map(line),
  ].join("\n");
}

/** A real <ul>/<ol>, with nested lists indented so they stay nested. */
function listToMarkdown(list: HTMLElement, indent = ""): string {
  const ordered = list.tagName === "OL";
  let number = Number.parseInt(list.getAttribute("start") ?? "", 10);
  if (!Number.isFinite(number)) number = 1;

  const lines: string[] = [];
  let lastMarkerWidth = 2;
  for (const item of Array.from(list.children)) {
    // Google Docs nests a sub-list as a sibling of the item it belongs to
    // (invalid HTML, but what it sends), not inside it.
    if (LIST_TAGS.has(item.tagName)) {
      const sub = listToMarkdown(item as HTMLElement, indent + " ".repeat(lastMarkerWidth));
      if (sub) lines.push(sub);
      continue;
    }
    if (item.tagName !== "LI") continue;
    const marker = ordered ? `${number}.` : "-";
    lastMarkerWidth = marker.length + 1;
    const parts: string[] = [];
    const nested: string[] = [];
    for (const child of Array.from(item.childNodes)) {
      if (isElement(child) && LIST_TAGS.has(child.tagName)) {
        nested.push(listToMarkdown(child, indent + " ".repeat(marker.length + 1)));
      } else {
        parts.push(inline(child));
      }
    }
    const text = parts
      .join("")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) lines.push(`${indent}${marker} ${text}`);
    lines.push(...nested.filter(Boolean));
    number += 1;
  }
  return lines.join("\n");
}

interface WordItem {
  level: number;
  ordered: boolean;
  text: string;
}

function wordItem(p: HTMLElement): WordItem {
  const marker = Array.from(p.querySelectorAll("span"))
    .find(isWordMarker)
    ?.textContent?.replace(/[\s ]+/g, "")
    .trim();
  const level = Number(/level(\d+)/i.exec(styleOf(p))?.[1] ?? "1");
  return {
    level: Number.isFinite(level) && level > 0 ? level : 1,
    // "1." / "a)" / "iv." are numbering; anything else (·, o, §, a Symbol-font
    // glyph) is a bullet.
    ordered: Boolean(marker && /^\(?([0-9]+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]$/.test(marker)),
    text: flat(p),
  };
}

function wordItemsToMarkdown(items: WordItem[]): string {
  const counters: number[] = [];
  return items
    .map((item) => {
      counters.length = item.level; // a shallower item ends the deeper counters
      counters[item.level - 1] = (counters[item.level - 1] ?? 0) + 1;
      const indent = "   ".repeat(item.level - 1);
      return `${indent}${item.ordered ? `${counters[item.level - 1]}.` : "-"} ${item.text}`;
    })
    .join("\n");
}

/** The blocks inside a container, each a paragraph, list, table or heading. */
function blocksOf(container: Node): string[] {
  const blocks: string[] = [];
  let run = "";
  let wordList: WordItem[] = [];

  const flushRun = () => {
    const text = run
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (text) blocks.push(text);
    run = "";
  };
  const flushWordList = () => {
    if (wordList.length) blocks.push(wordItemsToMarkdown(wordList));
    wordList = [];
  };

  for (const child of Array.from(container.childNodes)) {
    if (isText(child)) {
      flushWordList();
      run += inline(child);
      continue;
    }
    if (!isElement(child) || IGNORED_TAGS.has(child.tagName)) continue;

    if (child.tagName === "P" && isWordListParagraph(child)) {
      flushRun();
      const item = wordItem(child);
      if (item.text) wordList.push(item);
      continue;
    }
    flushWordList();

    if (LIST_TAGS.has(child.tagName)) {
      flushRun();
      const list = listToMarkdown(child);
      if (list) blocks.push(list);
    } else if (child.tagName === "TABLE") {
      flushRun();
      const table = tableToMarkdown(child);
      if (table) blocks.push(table);
    } else if (HEADING_TAGS.has(child.tagName)) {
      flushRun();
      // Headings are usually bold already; "### **Title**" is noise.
      const text = inline(child, true, true).replace(/\s+/g, " ").trim();
      if (text) blocks.push(`### ${text}`);
    } else if (child.tagName === "BLOCKQUOTE") {
      flushRun();
      const quoted = blocksOf(child).join("\n\n");
      if (quoted) blocks.push(quoted.replace(/^/gm, "> "));
    } else if (child.tagName === "HR") {
      flushRun();
    } else if (child.tagName === "PRE") {
      flushRun();
      const text = (child.textContent ?? "").replace(/\s+$/g, "").replace(/\*/g, "\\*");
      if (text.trim()) blocks.push(text);
    } else if (BLOCK_TAGS.has(child.tagName) || containsBlock(child)) {
      // A paragraph or div, or an inline wrapper that holds blocks (Google
      // Docs' <b> around the whole paste): walk into it.
      flushRun();
      if (child.tagName === "P" && !containsBlock(child)) {
        const text = inline(child)
          .replace(/[ \t]*\n[ \t]*/g, "\n")
          .replace(/[ \t]+/g, " ")
          .trim();
        if (text) blocks.push(text);
      } else {
        blocks.push(...blocksOf(child));
      }
    } else {
      run += inline(child);
    }
  }
  flushRun();
  flushWordList();
  return blocks;
}

/**
 * The Markdown for a block of pasted HTML. Needs a DOM (it is for the browser);
 * returns an empty string if there is none or nothing readable was found.
 */
export function htmlToMarkdown(html: string): string {
  if (typeof DOMParser === "undefined" || !html || html.length > MAX_HTML_LENGTH) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const markdown = blocksOf(doc.body).join("\n\n");
  return normalizeRichText(markdown.replace(/\n{3,}/g, "\n\n"));
}

// ─── Deciding what a paste is ────────────────────────────────────────────────

/**
 * Whether the HTML carries structure worth converting. A plain sentence copied
 * from a web page also arrives as HTML, and converting that would only risk
 * changing text that was fine as typed.
 */
function looksStructured(html: string): boolean {
  return (
    /<(li|table|h[1-6]|strong|b|em|i|a|br)[\s>]|font-weight:\s*(bold|[6-9]00)|mso-list|MsoList/i.test(
      html
    ) || (html.match(/<p[\s>]/gi) ?? []).length > 1
  );
}

/** Rows separated by line breaks and cells by tabs: what a spreadsheet copies as text. */
export function tabsToTable(text: string): string | null {
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split("\t").map((cell) => cell.trim().replace(/\|/g, "\\|")));
  if (rows.length < 2 || rows.some((row) => row.length < 2)) return null;
  // "•<tab>Division I" is a bulleted list, not a spreadsheet: a first column of
  // nothing but bullets or numbers is a list marker.
  if (rows.every((row) => /^([•◦▪▫‣⁃·o§-]|\d+[.)])$/.test(row[0] ?? ""))) return null;
  const width = Math.max(...rows.map((row) => row.length));
  const line = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => row[i] || " ").join(" | ")} |`;
  const [head, ...body] = rows;
  return [
    line(head!),
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map(line),
  ].join("\n");
}

export interface PasteResult {
  text: string;
  /** Where the text came from: the clipboard's HTML, a spreadsheet's tabs, or plain text. */
  source: "html" | "table" | "text";
  /** Whether it differs from the plain text that was copied, so the editor can say so. */
  changed: boolean;
}

/** What to put into the text box for a paste. */
export function cleanPastedContent(input: {
  html?: string | undefined;
  text?: string | undefined;
}): PasteResult {
  const plain = (input.text ?? "").replace(/\r\n?/g, "\n");

  if (input.html && looksStructured(input.html)) {
    const markdown = htmlToMarkdown(input.html);
    if (markdown) return { text: markdown, source: "html", changed: markdown !== plain.trim() };
  }

  const table = tabsToTable(plain);
  if (table) return { text: table, source: "table", changed: true };

  const text = normalizeRichText(plain);
  return { text, source: "text", changed: text !== plain.trim() };
}
