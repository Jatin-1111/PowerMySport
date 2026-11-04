/**
 * Turns a model's reply into text WhatsApp shows the way it was meant.
 *
 * The channel rules in the prompt ask for plain text, and the model mostly follows them,
 * but a rule in a prompt is a request, not a guarantee: replies have arrived with `* `
 * bullets, nested `* ` sub-bullets, `**double** asterisk bold`, `# headings` and
 * `[markdown](links)`, none of which WhatsApp renders. A parent then reads stray asterisks.
 * This runs on every reply, so the formatting no longer depends on the model remembering.
 *
 * What WhatsApp does render: `*bold*`, `_italic_`, `~strike~`, and bare URLs, which it turns
 * into links. Everything below converts toward those. It is a pure function of its input.
 */

const SITE = "https://powermysport.com";

/** The site's own pages the assistant points to. A bare "/guidance" does not work in WhatsApp. */
const KNOWN_PATHS = [
  "assessment/discover",
  "sport-profile",
  "guidance",
  "roadmap",
  "how-it-works",
  "experts",
  "planner",
  "tournaments",
  "faq",
  "ask",
  "contact",
];

const BULLET = "•";
const SUB_BULLET = "–";

const absolute = (target: string): string => (target.startsWith("/") ? `${SITE}${target}` : target);

/** `[label](url)` becomes `label: url`, with a relative url made absolute. */
function flattenLinks(line: string): string {
  return line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
    const full = absolute(url);
    return label.trim() === full || label.trim() === url ? full : `${label.trim()}: ${full}`;
  });
}

/** Markdown emphasis to WhatsApp's: bold is one asterisk, strike one tilde. */
function convertEmphasis(line: string): string {
  return line
    .replace(/\*\*\*(.+?)\*\*\*/g, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "*$1*")
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/`([^`]+)`/g, "$1");
}

/** A bare "/guidance" in a sentence becomes the full link. Not "and/or", not a path inside a URL. */
function absolutePaths(line: string): string {
  const alternatives = KNOWN_PATHS.map((path) => path.replace("/", "\\/")).join("|");
  const pattern = new RegExp(`(?<![\\w/.:@-])\\/(${alternatives})(?![\\w/-])`, "g");
  return line.replace(pattern, (_match, path: string) => `${SITE}/${path}`);
}

function convertLine(line: string): string | null {
  // A rule on its own line is decoration here.
  if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return null;

  const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
  if (heading) {
    const text = convertEmphasis(heading[1]!.replace(/\*+/g, "").trim());
    return text ? `*${text}*` : "";
  }

  const bullet = line.match(/^(\s*)[*\-+•]\s+(.*)$/);
  if (bullet) {
    const nested = bullet[1]!.replace(/\t/g, "  ").length >= 2;
    const body = absolutePaths(convertEmphasis(flattenLinks(bullet[2]!.trim())));
    return nested ? `   ${SUB_BULLET} ${body}` : `${BULLET} ${body}`;
  }

  const quote = line.replace(/^\s*>\s?/, "");
  return absolutePaths(convertEmphasis(flattenLinks(quote))).replace(/\s+$/, "");
}

export function formatForWhatsApp(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/^```[a-z]*\s*$/gm, "")
    .split("\n")
    .map(convertLine)
    .filter((line): line is string => line !== null);

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Cuts a reply to fit, at the last paragraph, line or sentence break near the end rather
 * than in the middle of a word, and says it was cut.
 */
export function clipReply(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const floor = Math.floor(max * 0.6);
  const breakAt = [head.lastIndexOf("\n\n"), head.lastIndexOf("\n"), head.search(/[.!?]\s[^.!?]*$/)]
    .map((index, position) => (position === 2 && index >= 0 ? index + 1 : index))
    .find((index) => index >= floor);
  const cut = breakAt !== undefined ? head.slice(0, breakAt) : head.replace(/\s+\S*$/, "");
  return `${cut.trimEnd()}…`;
}
