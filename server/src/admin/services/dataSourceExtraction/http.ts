import { lookup } from "node:dns/promises";
import { log } from "./gemini";

// ─── Direct page fetch (preferred over the urlContext tool for LINK sources) ──

/**
 * Blocks SSRF targets before we fetch an admin-supplied URL server-side.
 *
 * This endpoint is admin-only, but "can submit a data source" must not become
 * "can read cloud instance metadata" — 169.254.169.254 would hand out IAM
 * credentials, and localhost/private ranges expose internal services. The check
 * resolves DNS first and tests the resolved address, so a public hostname
 * pointing at a private IP is still refused.
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./, // loopback
  /^10\./, // private
  /^192\.168\./, // private
  /^172\.(1[6-9]|2\d|3[01])\./, // private
  /^169\.254\./, // link-local — cloud metadata
  /^0\./, // this-network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
];

async function resolveSafeHttpUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  try {
    const { address, family } = await lookup(url.hostname);
    if (family === 6) {
      const v6 = address.toLowerCase();
      // ::1 loopback, fc00::/7 unique-local, fe80::/10 link-local
      if (v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return null;
    } else if (BLOCKED_IP_PATTERNS.some((re) => re.test(address))) {
      return null;
    }
  } catch {
    return null; // unresolvable host
  }
  return url.toString();
}

/** Decodes one numeric HTML entity, falling back to the raw text — an out-of-range code point must not throw mid-extraction. */
function codePointOr(code: number, raw: string): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return raw;
  try {
    return String.fromCodePoint(code);
  } catch {
    return raw;
  }
}

/**
 * Decodes the entities that appear inside href attributes.
 *
 * Required, not cosmetic: HTML encodes query separators, so a raw href reads
 * `?eventuid=8774&amp;acceptid=30066`. Used as-is that sends a parameter
 * literally named "amp;acceptid" — and on AITA's signed fact-sheet URLs it
 * corrupts the signature, turning every download into a dead link.
 */
export function decodeAttributeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (m, hex: string) => codePointOr(parseInt(hex, 16), m))
    .replace(/&#(\d+);/g, (m, dec: string) => codePointOr(Number(dec), m));
}

/**
 * Rewrites `<a href="…">Label</a>` to `Label (absolute-url)` so links survive
 * the generic tag strip below.
 *
 * Without this the whole detail layer is unreachable: federation calendars link
 * each cell to a per-tournament page (AITA renders
 * `<a href='tournament-content?id=4997'>CS7 (Delhi)</a>`), and that page is the
 * only place the fact sheet, acceptance lists, host academy and exact date
 * exist. Flattening the anchor away left the model with the cell text alone, so
 * no prompt change could ever have recovered them.
 *
 * The URL is wrapped in PARENTHESES, deliberately not angle brackets: the
 * `<[^>]+>` strip further down treats `<https://…>` as a tag and deletes it,
 * which silently produced byte-identical output to not doing this at all.
 *
 * Relative hrefs resolve against the page's own URL. AITA's calendar lives at
 * /management/calendar.php but its links are root-relative in intent — the
 * resulting /management/tournament-content?id=… still 301s to the canonical
 * /tournament-content/?id=…, and we follow redirects, so both forms work.
 */
function inlineAnchorUrls(html: string, baseUrl: string): string {
  return html.replace(
    /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, _quoted, doubleQuoted, singleQuoted, inner) => {
      const href = decodeAttributeEntities(((doubleQuoted ?? singleQuoted ?? "") as string).trim());
      const label = (inner as string)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      // Fragment/script/contact links carry no page to follow; empty-label
      // anchors are icons and image wrappers, which only add noise.
      if (!href || !label || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) {
        return label;
      }
      let absolute = href;
      try {
        absolute = new URL(href, baseUrl).toString();
      } catch {
        // Unparseable href — keep the raw value rather than dropping the link.
      }
      return `${label} (${absolute})`;
    }
  );
}

/**
 * Flattens HTML to text, keeping row/cell boundaries so table-shaped calendars
 * stay readable. Pass `baseUrl` to keep link targets (see inlineAnchorUrls).
 */
export function htmlToText(html: string, baseUrl?: string): string {
  const withoutInertMarkup = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  return (
    (baseUrl ? inlineAnchorUrls(withoutInertMarkup, baseUrl) : withoutInertMarkup)
      // AITA renders date cells as "04,<br>May" — the break must become a space,
      // not vanish, or the day and month fuse into "04,May".
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<\/(tr|div|p|li|h[1-6]|table|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      // Numeric entities are everywhere in WordPress-rendered federation pages
      // (&#8211; for en-dashes in titles, &#038; in query strings); left raw they
      // end up inside extracted names and URLs.
      .replace(/&#x([0-9a-f]+);/gi, (m, hex: string) => codePointOr(parseInt(hex, 16), m))
      .replace(/&#(\d+);/g, (m, dec: string) => codePointOr(Number(dec), m))
      .replace(/[ \t]+/g, " ")
      // Deliberately NOT collapsing runs of empty cells: calendar tables encode
      // the age group by column position ("WEEK | Under 10 | Under 12 | ..."), so
      // "| | | CS7 (Jind) |" is the only thing distinguishing an Under-14 entry
      // from an Under-10 one. Collapsing the pipes discards that.
      .replace(/\n[ ]*\n+/g, "\n")
      .trim()
  );
}

const MAX_PAGE_TEXT_CHARS = 300_000;

/**
 * Drops site chrome — nav, sidebars, "More News" widgets, ad slots — before
 * flattening a page to text.
 *
 * This is what makes following per-tournament detail pages affordable: an AITA
 * tournament page is 140KB of HTML that flattens to ~17,500 characters, of
 * which about 700 describe the tournament and the rest is the news rail, the
 * social embeds and the footer. Stripping chrome first takes the same page to
 * ~1,500 characters, so a dozen of them fit in one extraction call instead of
 * one page barely fitting.
 *
 * Only applied to detail pages, never to calendars — a calendar IS a table of
 * links, and several of these selectors (`nav`, `menu`) would eat it.
 */
export function stripSiteChrome(html: string): string {
  return (
    html
      .replace(/<(nav|header|footer|aside|form|noscript|iframe|svg)\b[\s\S]*?<\/\1>/gi, " ")
      // Class-based, because most CMS themes mark chrome with a class rather
      // than a semantic element — AITA's news rail is a div.widget_boc_latest.
      .replace(
        /<(div|section|ul|ins)\b[^>]*\bclass\s*=\s*["'][^"']*\b(widget|sidebar|side-bar|menu|navbar|breadcrumb|footer|header|social|share|advert|adsbygoogle|related|more-?news|latest|comment)\b[^"']*["'][\s\S]*?<\/\1>/gi,
        " "
      )
  );
}

/**
 * Fetches the page ourselves and returns its text.
 *
 * Preferred over Gemini's urlContext tool for LINK sources, because that tool
 * *summarises* long pages instead of transcribing them: four reads of the AITA
 * 2026 calendar (~260KB) returned 151 stale entries, then 0, then 7, then 0,
 * and one ended with "view the source link directly". The same page fetched
 * directly yields every row deterministically — the dates are all in the
 * server-rendered HTML.
 *
 * Returns null when the fetch is blocked/fails, so callers can fall back to
 * urlContext for genuinely bot-gated or JS-rendered sources.
 */
export async function fetchPageHtml(
  url: string
): Promise<{ html: string; finalUrl: string } | null> {
  const safeUrl = await resolveSafeHttpUrl(url);
  if (!safeUrl) {
    log.warn("[DataSourceExtraction] refused to fetch unsafe/unresolvable URL");
    return null;
  }
  try {
    const res = await fetch(safeUrl, {
      redirect: "follow",
      headers: {
        // Some federation sites 403 an unrecognised agent.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      log.warn(`[DataSourceExtraction] direct fetch got HTTP ${res.status}`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
      log.warn(`[DataSourceExtraction] direct fetch got non-HTML content-type: ${contentType}`);
      return null;
    }
    // Resolve relative links against the FINAL url — federation sites redirect
    // liberally, and the pre-redirect path would build wrong absolute URLs.
    return { html: await res.text(), finalUrl: res.url || safeUrl };
  } catch (err) {
    log.warn(`[DataSourceExtraction] direct fetch failed: ${(err as Error).message.slice(0, 120)}`);
    return null;
  }
}

export async function fetchPageText(
  url: string,
  { stripChrome = false }: { stripChrome?: boolean } = {}
): Promise<string | null> {
  const page = await fetchPageHtml(url);
  if (!page) return null;
  const text = htmlToText(stripChrome ? stripSiteChrome(page.html) : page.html, page.finalUrl);
  return text.length > MAX_PAGE_TEXT_CHARS ? text.slice(0, MAX_PAGE_TEXT_CHARS) : text;
}

/** Runs `worker` over `items` with a fixed number of workers in flight. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}
