import { normalizeRichText } from "./normalize";
import { tabsToTable } from "./paste";

// ─── What the editor's toolbar buttons do to the text ───────────────────────
//
// Each function takes the text and the current selection and answers with one
// replacement and where the selection should end up. They are pure, and do not
// touch a text box: the editor applies the replacement in a way that keeps the
// browser's own undo working, and these can be tested without a browser.
//
// The text stays Markdown throughout. A button is only a quicker way to type
// the syntax, so a person who does know it loses nothing and one who does not
// never has to.

export interface TextEdit {
  /** Replace `value.slice(start, end)` with `text`. */
  start: number;
  end: number;
  text: string;
  /** Where the selection should be once the replacement is in. */
  selectionStart: number;
  selectionEnd: number;
}

/** The value after an edit; the editor uses the edit itself, tests use this. */
export const applyEdit = (value: string, edit: TextEdit): string =>
  value.slice(0, edit.start) + edit.text + value.slice(edit.end);

const BOLD = "**";
const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const ANY_LIST = /^\s*(?:[-*•]|\d+[.)])\s+/;
const HEADING = /^#{1,6}\s+/;
const BOLD_PLACEHOLDER = "bold text";

// ─── Bold ────────────────────────────────────────────────────────────────────

/** Bold the selection, or take bold off if it is already bold. */
export function toggleBold(value: string, selStart: number, selEnd: number): TextEdit {
  const selected = value.slice(selStart, selEnd);

  // Already bold, markers just outside the selection.
  if (
    selStart >= BOLD.length &&
    value.slice(selStart - BOLD.length, selStart) === BOLD &&
    value.slice(selEnd, selEnd + BOLD.length) === BOLD
  ) {
    return {
      start: selStart - BOLD.length,
      end: selEnd + BOLD.length,
      text: selected,
      selectionStart: selStart - BOLD.length,
      selectionEnd: selEnd - BOLD.length,
    };
  }

  // Already bold, markers inside the selection.
  if (
    selected.length >= BOLD.length * 2 + 1 &&
    selected.startsWith(BOLD) &&
    selected.endsWith(BOLD)
  ) {
    const inner = selected.slice(BOLD.length, -BOLD.length);
    return {
      start: selStart,
      end: selEnd,
      text: inner,
      selectionStart: selStart,
      selectionEnd: selStart + inner.length,
    };
  }

  const core = selected.trim();
  if (!core) {
    // Nothing selected: leave a placeholder, selected, ready to be typed over.
    return {
      start: selStart,
      end: selEnd,
      text: `${BOLD}${BOLD_PLACEHOLDER}${BOLD}`,
      selectionStart: selStart + BOLD.length,
      selectionEnd: selStart + BOLD.length + BOLD_PLACEHOLDER.length,
    };
  }
  // Spaces at the edges of the selection stay outside the markers: "** word**"
  // is not bold.
  const lead = selected.length - selected.trimStart().length;
  const trail = selected.length - selected.trimEnd().length;
  return {
    start: selStart,
    end: selEnd,
    text: `${selected.slice(0, lead)}${BOLD}${core}${BOLD}${selected.slice(selected.length - trail)}`,
    selectionStart: selStart + lead + BOLD.length,
    selectionEnd: selStart + lead + BOLD.length + core.length,
  };
}

// ─── Line-based blocks: lists and headings ───────────────────────────────────

/** The whole lines a selection touches. */
function lineSpan(value: string, selStart: number, selEnd: number) {
  const from = selStart === 0 ? 0 : value.lastIndexOf("\n", selStart - 1) + 1;
  // A selection that ends just after a line break does not include the next line.
  const to = selEnd > selStart && value[selEnd - 1] === "\n" ? selEnd - 1 : selEnd;
  const newline = value.indexOf("\n", to);
  const end = newline === -1 ? value.length : newline;
  return { from, end, lines: value.slice(from, end).split("\n") };
}

function transformLines(
  value: string,
  selStart: number,
  selEnd: number,
  transform: (lines: string[]) => string[]
): TextEdit {
  const { from, end, lines } = lineSpan(value, selStart, selEnd);
  const text = transform(lines).join("\n");
  return { start: from, end, text, selectionStart: from, selectionEnd: from + text.length };
}

const nonEmpty = (lines: string[]) => lines.filter((line) => line.trim());

/** Make the selected lines a bulleted list, or turn that off. */
export function toggleBulletList(value: string, selStart: number, selEnd: number): TextEdit {
  return transformLines(value, selStart, selEnd, (lines) => {
    const content = nonEmpty(lines);
    if (content.length === 0) return ["- "];
    const alreadyBullets = content.every((line) => BULLET.test(line));
    return lines.map((line) =>
      !line.trim()
        ? line
        : alreadyBullets
          ? line.replace(BULLET, "")
          : `- ${line.replace(ANY_LIST, "").trimStart()}`
    );
  });
}

/** Make the selected lines a numbered list, or turn that off. */
export function toggleNumberedList(value: string, selStart: number, selEnd: number): TextEdit {
  return transformLines(value, selStart, selEnd, (lines) => {
    const content = nonEmpty(lines);
    if (content.length === 0) return ["1. "];
    const alreadyNumbered = content.every((line) => NUMBER.test(line));
    let n = 0;
    return lines.map((line) => {
      if (!line.trim()) return line;
      if (alreadyNumbered) return line.replace(NUMBER, "");
      n += 1;
      return `${n}. ${line.replace(ANY_LIST, "").trimStart()}`;
    });
  });
}

/** Make the selected lines a heading, or turn that off. */
export function toggleHeading(value: string, selStart: number, selEnd: number): TextEdit {
  return transformLines(value, selStart, selEnd, (lines) => {
    const content = nonEmpty(lines);
    if (content.length === 0) return ["### "];
    const alreadyHeadings = content.every((line) => HEADING.test(line));
    return lines.map((line) =>
      !line.trim()
        ? line
        : alreadyHeadings
          ? line.replace(HEADING, "")
          : `### ${line.replace(HEADING, "").replace(ANY_LIST, "").trimStart()}`
    );
  });
}

// ─── Table ───────────────────────────────────────────────────────────────────

const TABLE_TEMPLATE = [
  "| Heading | Heading | Heading |",
  "| --- | --- | --- |",
  "| Cell | Cell | Cell |",
  "| Cell | Cell | Cell |",
].join("\n");

/**
 * Put a table at the cursor, with blank lines around it (Markdown needs them).
 * If the selection is rows pasted from a spreadsheet as tab-separated text, it
 * becomes the table instead of a blank template.
 */
export function insertTable(value: string, selStart: number, selEnd: number): TextEdit {
  const selected = value.slice(selStart, selEnd);
  const converted = selected ? tabsToTable(selected) : null;
  const table = converted ?? TABLE_TEMPLATE;
  const start = converted ? selStart : selEnd;

  const before = value.slice(0, start);
  const after = value.slice(selEnd);
  const lead =
    before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail =
    after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";

  const tableStart = start + lead.length;
  return {
    start,
    end: selEnd,
    text: `${lead}${table}${trail}`,
    // A blank template selects its first heading, ready to be typed over.
    selectionStart: converted ? tableStart : tableStart + 2,
    selectionEnd: converted ? tableStart + table.length : tableStart + 2 + "Heading".length,
  };
}

// ─── Tidy ────────────────────────────────────────────────────────────────────

/** Rewrite the whole text with the paste cleaner's rules, for text pasted before it existed. */
export function tidyAll(value: string): TextEdit {
  const text = normalizeRichText(value);
  return {
    start: 0,
    end: value.length,
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  };
}
