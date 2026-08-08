import axios, { AxiosInstance, AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import { AitaCategory, DiscoveredSnapshot } from "./types";

/**
 * HTTP client for AITA's ranking pages.
 *
 * ── The one thing that will bite anyone who edits this ────────────────────────
 * `ranking2.php` is session-stateful. It returns an EMPTY date list unless
 * `ranking.php?q=<Category>` was called first on the same PHP session, because
 * the category is held server-side rather than passed. So every lookup runs
 * through `withSession`, which keeps a cookie jar for the life of one category
 * walk. Categories may be walked concurrently *only* in separate sessions —
 * sharing one means the second category silently overwrites the first and you
 * get the wrong list back with a 200.
 *
 * ── The second thing ─────────────────────────────────────────────────────────
 * PDF filenames are never constructed. They look derivable (`2026-07-27_BU-14.pdf`)
 * right up until they are not (`2021-06-07_45+SINGLES.pdf`, `2026-07-06_WHEELCHAIR MS.pdf`
 * — note the space). The href is always read off the result page.
 *
 * Also worth knowing: the date `<option>` shows `DD-MM-YYYY` but its `value` is
 * `YYYY-MM-DD`, and posting the display format returns an empty result table
 * with a 200 rather than an error.
 */

const BASE_URL = "https://aitatennis.com";

/**
 * Identifies us and gives AITA somewhere to complain to. This is a courtesy
 * that also makes us easy to allowlist if we end up with a data-sharing
 * arrangement — do not replace it with a browser string.
 */
const USER_AGENT =
  "PowerMySportBot/1.0 (+https://powermysport.com; teams@powermysport.com)";

/** Their box is a small WordPress install. One request every 1.5s, serialised. */
const MIN_REQUEST_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export interface FetchedPdf {
  buffer: Buffer;
  byteSize: number;
  etag?: string;
  lastModified?: string;
}

export class AitaRankingSource {
  private http: AxiosInstance;
  /** Serialises every request in this process so the rate limit actually holds. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor() {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      // 404s and 500s are handled as data, not thrown, so a single dead combo
      // does not abort a sweep.
      validateStatus: () => true,
      maxRedirects: 5,
    });
  }

  private async throttle(): Promise<void> {
    const wait = Math.max(0, this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  /** Serialised + rate-limited + retried GET. Every request goes through here. */
  private request<T = string>(
    url: string,
    cookies: CookieJar,
    responseType: "text" | "arraybuffer" = "text",
    extraHeaders: Record<string, string> = {},
  ): Promise<AxiosResponse<T>> {
    const run = async (): Promise<AxiosResponse<T>> => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await this.throttle();
        try {
          const res = await this.http.get<T>(url, {
            responseType,
            headers: { ...cookies.header(), ...extraHeaders },
          });
          cookies.absorb(res.headers["set-cookie"]);
          // Retry only on transient server-side trouble.
          if (res.status >= 500 && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
            continue;
          }
          return res;
        } catch (err) {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error(`GET ${url} failed after ${MAX_RETRIES} attempts`);
    };

    // Chain onto the queue so concurrent callers still go out one at a time.
    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  /**
   * Runs `fn` against a fresh PHP session pinned to `category`. Everything that
   * touches `ranking2.php` must be inside one of these.
   */
  private async withSession<T>(
    category: AitaCategory,
    fn: (cookies: CookieJar) => Promise<T>,
  ): Promise<T> {
    const cookies = new CookieJar();
    // This call is what puts the category into the session. Its body (the
    // subcategory options) is useful too, but the side effect is the point.
    await this.request(
      `/management/ajax/ranking.php?q=${encodeURIComponent(category)}`,
      cookies,
    );
    return fn(cookies);
  }

  /** Subcategories AITA currently offers for a category, e.g. ["U-12", …]. */
  async listSubcategories(category: AitaCategory): Promise<string[]> {
    const cookies = new CookieJar();
    const res = await this.request<string>(
      `/management/ajax/ranking.php?q=${encodeURIComponent(category)}`,
      cookies,
    );
    return parseOptionValues(res.data);
  }

  /**
   * Every as-on date published for a combo, newest first (YYYY-MM-DD).
   * Empty is a legitimate answer for the stale Seniors lists — but it is also
   * what a broken session looks like, which is why the session is established
   * here rather than left to the caller.
   */
  async listDates(category: AitaCategory, subcategory: string): Promise<string[]> {
    return this.withSession(category, async (cookies) => {
      const res = await this.request<string>(
        `/management/ajax/ranking2.php?q=${encodeURIComponent(subcategory)}`,
        cookies,
      );
      return parseOptionValues(res.data).filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
    });
  }

  /** The newest as-on date for a combo, or null if it publishes nothing. */
  async latestDate(category: AitaCategory, subcategory: string): Promise<string | null> {
    const dates = await this.listDates(category, subcategory);
    return dates[0] ?? null;
  }

  /**
   * Resolves the PDF for one (category, subcategory, date). Returns null when
   * the result page renders its table with an empty body, which is how AITA
   * signals "no document for that combination".
   */
  async resolveSnapshot(
    category: AitaCategory,
    subcategory: string,
    asOnDate: string,
  ): Promise<DiscoveredSnapshot | null> {
    const sourceUrl =
      `${BASE_URL}/rankingresult/?cat=${encodeURIComponent(category)}` +
      `&subcat=${encodeURIComponent(subcategory)}&date1=${encodeURIComponent(asOnDate)}`;

    const cookies = new CookieJar();
    const res = await this.request<string>(sourceUrl, cookies);
    if (res.status !== 200 || typeof res.data !== "string") return null;

    const $ = cheerio.load(res.data);
    const href = $("a[href*='upload/ranking/']").first().attr("href");
    if (!href) return null;

    // Hrefs are relative (`../management/upload/ranking/…`) and some filenames
    // contain spaces or `+`, so let URL do the resolving and escaping.
    const pdfUrl = new URL(href, sourceUrl).toString();
    return { category, subcategory, asOnDate, pdfUrl, sourceUrl };
  }

  /**
   * Cheap check for a silently corrected re-upload. AITA reissues a fixed PDF
   * under the same as-on date, which the date dropdown cannot show — so the
   * only signal is the file's own validators changing.
   */
  async headPdf(
    pdfUrl: string,
  ): Promise<{ etag?: string; lastModified?: string; byteSize?: number }> {
    const cookies = new CookieJar();
    await this.throttle();
    const res = await this.http.head(pdfUrl, { headers: cookies.header() });
    const out: { etag?: string; lastModified?: string; byteSize?: number } = {};
    const etag = res.headers["etag"];
    const lastModified = res.headers["last-modified"];
    const length = res.headers["content-length"];
    if (typeof etag === "string") out.etag = etag;
    if (typeof lastModified === "string") out.lastModified = lastModified;
    if (typeof length === "string") out.byteSize = Number(length);
    return out;
  }

  /** Downloads a ranking PDF. */
  async fetchPdf(pdfUrl: string): Promise<FetchedPdf> {
    const cookies = new CookieJar();
    const res = await this.request<ArrayBuffer>(pdfUrl, cookies, "arraybuffer");
    if (res.status !== 200) {
      throw new Error(`PDF fetch failed (${res.status}): ${pdfUrl}`);
    }
    const buffer = Buffer.from(res.data);
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      // A WordPress error page returns 200 with HTML. Catch it here rather than
      // letting the parser produce a confusing "0 rows" result.
      throw new Error(`Response is not a PDF: ${pdfUrl}`);
    }
    const out: FetchedPdf = { buffer, byteSize: buffer.byteLength };
    const etag = res.headers["etag"];
    const lastModified = res.headers["last-modified"];
    if (typeof etag === "string") out.etag = etag;
    if (typeof lastModified === "string") out.lastModified = lastModified;
    return out;
  }
}

/** Minimal cookie jar — AITA only ever sets PHPSESSID, so this need not be clever. */
class CookieJar {
  private jar = new Map<string, string>();

  absorb(setCookie: string[] | undefined): void {
    for (const raw of setCookie ?? []) {
      const pair = raw.split(";")[0];
      const eq = pair?.indexOf("=") ?? -1;
      if (!pair || eq <= 0) continue;
      this.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  header(): Record<string, string> {
    if (this.jar.size === 0) return {};
    return {
      Cookie: [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    };
  }
}

/** Pulls non-empty `<option value="…">` values out of an AJAX fragment. */
function parseOptionValues(html: string): string[] {
  if (typeof html !== "string") return [];
  const $ = cheerio.load(html);
  return $("option")
    .map((_, el) => $(el).attr("value") ?? "")
    .get()
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export const aitaRankingSource = new AitaRankingSource();
