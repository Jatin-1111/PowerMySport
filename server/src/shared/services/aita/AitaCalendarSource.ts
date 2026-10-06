import axios, { type AxiosInstance } from "axios";
import { parseFactSheet, parseMonthPage, type FactSheet, type MonthRow } from "./calendarParser";

/**
 * HTTP client for AITA's tournament calendar on the hitcourt.com platform.
 *
 * Read-only: it issues GETs for public pages and nothing else. No login, no form,
 * no session. `robots.txt` on the platform allows these pages (it disallows the
 * admin, player, account, referee, association and writable areas) and its Terms
 * of Service, read 2026-10-06, say nothing about automated access. Neither is a
 * licence, which is why the same courtesies as the ranking reader apply.
 *
 * ── Why the month address is built here ─────────────────────────────────────
 * The calendar's own filter is script-driven and ignores query parameters, but the
 * site's script navigates to a plain address for each month: the base64 encoding of
 * `year###month###2###state###grade###region`, with 0 meaning "all". That is a page
 * any browser can open, so it is read the same way.
 *
 * ── Conventions shared with AitaRankingSource ───────────────────────────────
 * An honest user-agent that says who is asking and where to complain, one request
 * at a time, at least 1.5 seconds apart, a few retries on server errors. They are
 * restated here and not imported because that class keeps its queue private; if a
 * third AITA reader appears, extract a shared client.
 */

const BASE_URL = "https://www.aita.hitcourt.com";

const USER_AGENT = "PowerMySportBot/1.0 (+https://powermysport.com; teams@powermysport.com)";

const MIN_REQUEST_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

export interface HtmlResponse {
  status: number;
  body: string;
}

/** Fetches one address. Replaceable, so tests never reach the network. */
export type FetchHtml = (url: string) => Promise<HtmlResponse>;

/**
 * The address of AITA's calendar page for one month. `month` is 1 to 12.
 *
 * The third field is a month offset and not a filter: the page's own tabs link
 * `1` (the month before), `2` (the month named) and `3` (the month after), so
 * `2` is the one that returns the month asked for. Checked 2026-10-06: November
 * with `2` listed 41 events, with `3` it listed none.
 */
export function monthUrl(year: number, month: number): string {
  const encoded = Buffer.from(`${year}###${month}###2###0###0###0`).toString("base64");
  return `${BASE_URL}/tournament-list-calendar-monthly-${encoded}`;
}

export class AitaCalendarSource {
  private readonly http: AxiosInstance | null;
  private readonly fetchHtml: FetchHtml;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: { fetchHtml?: FetchHtml } = {}) {
    if (options.fetchHtml) {
      this.http = null;
      this.fetchHtml = options.fetchHtml;
      return;
    }
    const http = axios.create({
      timeout: REQUEST_TIMEOUT_MS,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      // Handled as data: one dead page must not abort a sweep.
      validateStatus: () => true,
      maxRedirects: 5,
      maxContentLength: 16 * 1024 * 1024,
    });
    this.http = http;
    this.fetchHtml = async (url) => {
      const response = await http.get<string>(url, { responseType: "text" });
      return {
        status: response.status,
        body: typeof response.data === "string" ? response.data : String(response.data),
      };
    };
  }

  private async throttle(): Promise<void> {
    const wait = Math.max(0, this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }

  /** Serialised, rate-limited and retried. Every request goes through here. */
  private request(url: string): Promise<string> {
    const run = async (): Promise<string> => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        await this.throttle();
        try {
          const response = await this.fetchHtml(url);
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
            continue;
          }
          if (response.status !== 200) {
            // A 4xx is an answer, not a fault that will clear on its own.
            const permanent = response.status < 500;
            const failure = new Error(`GET ${url} returned ${response.status}`);
            if (permanent) throw Object.assign(failure, { permanent });
            throw failure;
          }
          return response.body;
        } catch (error) {
          lastError = error;
          if ((error as { permanent?: boolean }).permanent) break;
          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error(`GET ${url} failed`);
    };

    const chained = this.queue.then(run, run);
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  /** Every event AITA lists for a month, in the order the page gives them. */
  async fetchMonth(year: number, month: number): Promise<{ sourceUrl: string; rows: MonthRow[] }> {
    const sourceUrl = monthUrl(year, month);
    const rows = parseMonthPage(await this.request(sourceUrl));
    return { sourceUrl, rows };
  }

  /** One event's fact sheet: its deadlines, fees and venue. */
  async fetchFactSheet(factSheetUrl: string): Promise<FactSheet> {
    return parseFactSheet(await this.request(factSheetUrl));
  }
}
