import axios, { AxiosInstance, AxiosResponse } from "axios";
import { AitaList, AitaState, AitaWeek, DiscoveredSnapshot } from "./types";

/**
 * HTTP client for AITA's ranking pages on the hitcourt.com platform.
 *
 * ── What replaced what (cutover found 2026-08-29) ─────────────────────────────
 * AITA moved off WordPress. The old three-step walk —
 * `ranking.php` -> `ranking2.php` -> `rankingresult` -> a PDF href — is gone;
 * every one of those routes now 404s, and it 404s *quietly*: the old client read
 * an empty option list out of the error body and concluded the combination
 * simply published nothing. Two requests replace all four:
 *
 *   1. GET /ranking-weekof-by-year?year=2026   -> JSON week list
 *   2. GET /ranking-view?wid=&category=&record= -> the whole list as HTML
 *
 * Three things about the new source are worth knowing before editing this file.
 *
 * ── 1. The JSON endpoints need one header, and nothing else ───────────────────
 * `X-Requested-With: XMLHttpRequest` is the entire admission requirement. There
 * is no session to establish, no cookie to carry and no CSRF token to echo —
 * so the CookieJar and the strict 1->2->3 ordering that dominated the old client
 * are deleted rather than ported. Without the header the endpoints answer **200**
 * with the body `No direct script access allowed`, which is why `requestJson`
 * checks for that string explicitly: a 200 that is not JSON must be an error
 * here, not zero results.
 *
 * ── 2. `record` is not enforced server-side ───────────────────────────────────
 * The page's own dropdown offers 25/50/75/100, but the server ignores the cap.
 * Measured on the largest list (Boys U-14, 1,663 rows): `record=3000` returned
 * every row in one 3.9 MB response in 6.3 s. So a list is still one request,
 * as it was when it was a PDF — a faithful port of the pagination would have
 * cost 447 requests a sweep for nothing. `fetchList` asserts it did not come
 * back exactly full, because that is what truncation would look like.
 *
 * ── 3. Do not use the PDF export as the data source ───────────────────────────
 * `/ranking-pdf` still exists and still returns a real PDF, but it is a freshly
 * generated document with *fewer* columns than the HTML: names are truncated
 * ("Riaan NANDANKAR" for "Riaan Atul NANDANKAR"), state is replaced by country,
 * and there is no point breakdown. It is kept here only as an archival artefact.
 */

/**
 * `aitatennis.com` still resolves, but serves only the new marketing homepage —
 * every data route on it answers 404 with a JSON body. The data lives here.
 */
const BASE_URL = "https://www.aita.hitcourt.com";

/**
 * Identifies us and gives AITA somewhere to complain to. This is a courtesy
 * that also makes us easy to allowlist if we end up with a data-sharing
 * arrangement — do not replace it with a browser string.
 */
const USER_AGENT = "PowerMySportBot/1.0 (+https://powermysport.com; teams@powermysport.com)";

/** One request every 1.5s, serialised. Their robots.txt allows us; be polite anyway. */
const MIN_REQUEST_INTERVAL_MS = 1500;
/** A full list is several megabytes of HTML, so this is deliberately generous. */
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;

/**
 * Asked for on every list fetch. Comfortably above the largest list (1,663 rows
 * on Boys U-14) so one request is always enough, and low enough that a runaway
 * response is bounded.
 */
const LIST_PAGE_SIZE = 5000;

/** The body the JSON endpoints return when the AJAX header is missing. */
const DIRECT_ACCESS_REFUSAL = "No direct script access allowed";

/** IST is a fixed +05:30 with no DST, so no timezone library is needed. */
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export interface FetchedList {
  html: string;
  byteSize: number;
  sourceUrl: string;
}

/** Shape of the `{status, message, token, data}` envelope every endpoint uses. */
interface AitaEnvelope<T> {
  status?: boolean;
  message?: string;
  token?: string;
  data?: T;
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
      // 404s and 500s are handled as data, not thrown, so a single dead list
      // does not abort a sweep.
      validateStatus: () => true,
      maxRedirects: 5,
      // A 4 MB list would otherwise trip axios' default body ceiling.
      maxContentLength: 64 * 1024 * 1024,
      maxBodyLength: 64 * 1024 * 1024,
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
    responseType: "text" | "arraybuffer" = "text",
    extraHeaders: Record<string, string> = {}
  ): Promise<AxiosResponse<T>> {
    const run = async (): Promise<AxiosResponse<T>> => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await this.throttle();
        try {
          const res = await this.http.get<T>(url, {
            responseType,
            headers: extraHeaders,
          });
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
   * GET one of the AJAX endpoints and unwrap its envelope.
   *
   * The failure this exists to catch is the polite one: without the AJAX header
   * the platform replies 200 with a plain-text refusal, and an earlier draft of
   * this client would have read that as "no weeks published" — the exact silent
   * failure mode that hid the cutover for three weeks. So anything that is not
   * a JSON envelope with `status: true` throws.
   */
  private async requestJson<T>(path: string): Promise<T> {
    const res = await this.request<string>(path, "text", {
      "X-Requested-With": "XMLHttpRequest",
    });

    if (res.status !== 200) {
      throw new Error(`GET ${path} returned ${res.status}`);
    }
    const body = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    if (body.includes(DIRECT_ACCESS_REFUSAL)) {
      throw new Error(
        `AITA refused ${path} with "${DIRECT_ACCESS_REFUSAL}" — the AJAX header ` +
          `is missing or the platform has started requiring a session token.`
      );
    }

    let envelope: AitaEnvelope<T>;
    try {
      envelope =
        typeof res.data === "string" ? JSON.parse(res.data) : (res.data as AitaEnvelope<T>);
    } catch {
      throw new Error(`GET ${path} returned non-JSON (first 200 chars: ${body.slice(0, 200)})`);
    }
    if (envelope.status !== true || envelope.data === undefined) {
      throw new Error(
        `GET ${path} answered status=${envelope.status} (${envelope.message ?? "no message"})`
      );
    }
    return envelope.data;
  }

  /**
   * Every publication week AITA lists for a year, newest first.
   *
   * Weeks have real gaps — 2026 lists 28 of them, with nothing for 26 Jan,
   * 20 Apr or 29 Jun — so this is a list to be read, not a series to be
   * generated.
   */
  async listWeeks(year: number): Promise<AitaWeek[]> {
    const raw = await this.requestJson<Array<{ key: number | string; value: string }>>(
      `/ranking-weekof-by-year?year=${encodeURIComponent(String(year))}`
    );
    return raw
      .map((row) => {
        const wid = Number(row.key);
        if (!Number.isFinite(wid) || wid <= 0) return null;
        return { wid, asOnDate: widToIsoDate(wid), label: String(row.value ?? "") };
      })
      .filter((w): w is AitaWeek => w !== null)
      .sort((a, b) => b.wid - a.wid);
  }

  /**
   * The newest week AITA has published, across all lists.
   *
   * One 3 KB call now covers what the old sentinel needed two session-bound
   * requests for, and covers every list rather than standing in for them.
   *
   * Falls back to the previous year when the current one is still empty —
   * otherwise the pipeline would go blind every January until AITA files the
   * first week of the new year.
   */
  async latestWeek(now: Date = new Date()): Promise<AitaWeek | null> {
    const currentYear = istYear(now);
    for (const year of [currentYear, currentYear - 1]) {
      const weeks = await this.listWeeks(year);
      if (weeks[0]) return weeks[0];
    }
    return null;
  }

  /**
   * Resolves one (list, week) into the coordinates a fetch needs.
   *
   * Kept as a distinct step even though it now costs no request: the ingest
   * service's flow reads better for it, and the week list is the thing that has
   * to be consulted before a list URL means anything.
   */
  async resolveSnapshot(list: AitaList, week: AitaWeek): Promise<DiscoveredSnapshot> {
    return {
      category: list.category,
      subcategory: list.subcategory,
      asOnDate: week.asOnDate,
      wid: week.wid,
      sourceUrl: listUrl(list, week.wid),
    };
  }

  /**
   * Fetches a whole ranking list as HTML — one request, every row.
   *
   * Deliberately does *not* send the AJAX header: this is a normal page, and
   * there is no reason to hint otherwise at a server we do not control.
   */
  async fetchList(list: AitaList, wid: number): Promise<FetchedList> {
    const sourceUrl = listUrl(list, wid);
    const res = await this.request<string>(
      `/ranking-view?wid=${wid}&category=${encodeURIComponent(list.code)}` +
        `&page=1&record=${LIST_PAGE_SIZE}`
    );
    if (res.status !== 200 || typeof res.data !== "string") {
      throw new Error(`Ranking list fetch failed (${res.status}): ${sourceUrl}`);
    }
    const html = res.data;
    // The platform is three weeks old; a route rename would otherwise arrive as
    // a confusing "0 rows parsed" from a perfectly successful 200.
    if (!html.includes("rankingCard")) {
      throw new Error(
        `Ranking list at ${sourceUrl} contains no ranking rows — the page layout ` +
          `or route has changed.`
      );
    }
    return { html, byteSize: Buffer.byteLength(html, "utf8"), sourceUrl };
  }

  /** How many rows one request can hold, so the parser can spot truncation. */
  get listPageSize(): number {
    return LIST_PAGE_SIZE;
  }

  /**
   * AITA's own state table: canonical names, two-letter codes, and the zone.
   *
   * Worth preferring over our hand-maintained map for the reason recorded in
   * `stateCodes.ts` — a state name we get wrong does not degrade, it 400s an API
   * call and 404s a whole page. Taking the names from the source that also
   * publishes the codes removes the drift entirely.
   */
  async listStates(): Promise<AitaState[]> {
    const raw =
      await this.requestJson<
        Array<{ name?: string; short_code?: string; region_id?: string | number }>
      >("/ranking-state");
    return raw
      .map((row) => {
        const code = String(row.short_code ?? "")
          .trim()
          .toUpperCase();
        const name = String(row.name ?? "").trim();
        if (!code || !name) return null;
        return { code, name, zoneId: Number(row.region_id) || 0 };
      })
      .filter((s): s is AitaState => s !== null);
  }

  /**
   * One player's point breakdown.
   *
   * Returns the HTML fragment; `parsePointBreakdown` turns it into slices.
   *
   * Costs one request per player, which is why the ingest does not call this for
   * every row — twelve lists is roughly 11,000 players a week. See the note on
   * `mergePointBreakdowns` in the ingest service for what that means for the
   * points-composition feature.
   */
  async fetchPointBreakdown(
    list: AitaList,
    wid: number,
    playerKey: string,
    rank: number
  ): Promise<string> {
    const data = await this.requestJson<string>(
      `/ranking-player-point-view?rank=${encodeURIComponent(String(rank))}` +
        `&player_id=${encodeURIComponent(playerKey)}` +
        `&category=${list.categoryId}&weekof=${wid}`
    );
    if (typeof data !== "string") {
      throw new Error(`Point breakdown for ${playerKey} was not an HTML fragment`);
    }
    return data;
  }

  /**
   * The platform's own PDF of a list, for the archive only.
   *
   * Note it takes the *numeric* category id, not the code — the one place the
   * two vocabularies meet in a single URL.
   */
  async fetchListPdf(list: AitaList, wid: number): Promise<Buffer> {
    const url =
      `/ranking-pdf?wid=${wid}&category=${list.categoryId}` +
      `&player=&page=1&record=${LIST_PAGE_SIZE}`;
    const res = await this.request<ArrayBuffer>(url, "arraybuffer");
    if (res.status !== 200) {
      throw new Error(`PDF export failed (${res.status}): ${BASE_URL}${url}`);
    }
    const buffer = Buffer.from(res.data);
    if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new Error(`PDF export returned non-PDF content: ${BASE_URL}${url}`);
    }
    return buffer;
  }
}

/** Public URL of a ranking list, as a person would open it. */
export function listUrl(list: AitaList, wid: number): string {
  return `${BASE_URL}/ranking-view?wid=${wid}&category=${list.code}` + `&page=1&record=25`;
}

/** Public URL of a player's profile on AITA's site. */
export function playerProfileUrl(playerKey: string): string {
  return `${BASE_URL}/player-profile-${playerKey}`;
}

/**
 * `1786300200` -> `2026-08-10`.
 *
 * The week id is midnight IST, which is 18:30 UTC the day *before* — so reading
 * it as a UTC date is off by one. Shifting into IST before slicing is the whole
 * trick.
 */
export function widToIsoDate(wid: number): string {
  return new Date(wid * 1000 + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `2026-08-10` -> `1786300200`. Inverse of `widToIsoDate`. */
export function isoDateToWid(asOnDate: string): number {
  return Math.round((Date.parse(`${asOnDate}T00:00:00Z`) - IST_OFFSET_MS) / 1000);
}

/** The year it is in India, which is the year AITA files weeks under. */
function istYear(now: Date): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCFullYear();
}

export const aitaRankingSource = new AitaRankingSource();
