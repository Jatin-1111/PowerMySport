import axios from "axios";
import {
  parseAcceptanceCategory,
  parseCategories,
  type ListedCategory,
  type ParsedCategory,
} from "./acceptanceParser";

/**
 * Reads one event's public acceptance list, the way the page itself does.
 *
 * ── How the page does it ────────────────────────────────────────────────────
 * The fact sheet is a normal page. Its Acceptance List tab is filled in by the browser:
 *
 *   1. open the fact sheet; the page carries a one-time token in its script
 *   2. GET /tournament-acceptance-list   (token, tour id)  -> the categories, and a new token
 *   3. GET /tournament-acceptance-load   (token, tour id, category id) -> one category, and
 *      a new token; once per category
 *
 * Each answer hands back the token for the next request, and the session cookie from
 * step 1 must come along. This does exactly that and nothing more: no login, no hidden
 * address, the same three requests a visitor's browser makes when they open the tab.
 *
 * ── Manners ─────────────────────────────────────────────────────────────────
 * The same as the calendar reader: a user agent that says who is asking and where to
 * complain, one request at a time, at least 1.5 seconds apart, a few retries on a server
 * error. They are restated and not shared; this is the third AITA reader, so extracting
 * one client is now justified and is the first thing to do if a fourth appears.
 */

const BASE_URL = "https://www.aita.hitcourt.com";
const USER_AGENT = "PowerMySportBot/1.0 (+https://powermysport.com; teams@powermysport.com)";
const MIN_REQUEST_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

export interface AcceptanceResponse {
  status: number;
  body: string;
  /** `Set-Cookie` values, when the server sent any. */
  cookies?: string[];
}

/** Replaceable, so tests never reach the network. */
export type FetchAcceptance = (
  url: string,
  options: { ajax: boolean; cookie: string }
) => Promise<AcceptanceResponse>;

export interface FetchedCategory extends ListedCategory {
  /** Null when the category had no readable main draw. */
  parsed: ParsedCategory | null;
}

export interface FetchedEvent {
  tourId: number;
  /** The page's own title, which names the level: "AITA National Series Tournament". */
  title: string;
  categories: FetchedCategory[];
}

const defaultFetch: FetchAcceptance = async (url, { ajax, cookie }) => {
  const response = await axios.get<string>(url, {
    timeout: REQUEST_TIMEOUT_MS,
    responseType: "text",
    validateStatus: () => true,
    maxRedirects: 5,
    maxContentLength: 16 * 1024 * 1024,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: ajax ? "application/json" : "text/html",
      ...(ajax ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const raw = response.headers["set-cookie"];
  return {
    status: response.status,
    body: typeof response.data === "string" ? response.data : String(response.data),
    ...(raw ? { cookies: raw } : {}),
  };
};

export const factSheetUrl = (tourId: number): string =>
  `${BASE_URL}/tournament-acceptance-factsheet-${Buffer.from(String(tourId)).toString("base64")}`;

export class AitaAcceptanceSource {
  private readonly fetchPage: FetchAcceptance;
  private lastRequestAt = 0;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly interval: number;

  constructor(
    options: {
      fetch?: FetchAcceptance;
      sleep?: (ms: number) => Promise<void>;
      intervalMs?: number;
    } = {}
  ) {
    this.fetchPage = options.fetch ?? defaultFetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.interval = options.intervalMs ?? MIN_REQUEST_INTERVAL_MS;
  }

  private async request(
    url: string,
    options: { ajax: boolean; cookie: string }
  ): Promise<AcceptanceResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const wait = Math.max(0, this.lastRequestAt + this.interval - Date.now());
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = Date.now();
      try {
        const response = await this.fetchPage(url, options);
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await this.sleep(2000 * attempt);
          continue;
        }
        if (response.status !== 200) {
          throw Object.assign(new Error(`GET ${url} returned ${response.status}`), {
            permanent: response.status < 500,
          });
        }
        return response;
      } catch (error) {
        lastError = error;
        if ((error as { permanent?: boolean }).permanent) break;
        if (attempt < MAX_RETRIES) await this.sleep(2000 * attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`GET ${url} failed`);
  }

  /** The whole acceptance list for an event: every singles category, parsed to numbers. */
  async fetchEvent(tourId: number): Promise<FetchedEvent> {
    const page = await this.request(factSheetUrl(tourId), { ajax: false, cookie: "" });
    const cookie = (page.cookies ?? []).map((value) => value.split(";")[0]).join("; ");
    const token = /csrf_form_token","([a-f0-9]+)"/.exec(page.body)?.[1];
    if (!token) throw new Error(`No token on the fact sheet for tournament ${tourId}`);
    const title = /<title>([^<]*)<\/title>/.exec(page.body)?.[1]?.trim() ?? "";

    const listUrl = (t: string) =>
      `${BASE_URL}/tournament-acceptance-list?csrf_form_token=${t}&tour_id=${tourId}`;
    const first = JSON.parse((await this.request(listUrl(token), { ajax: true, cookie })).body) as {
      status?: boolean;
      token?: string;
      data?: string;
    };
    if (!first.status || !first.data || !first.token) {
      return { tourId, title, categories: [] };
    }

    let next = first.token;
    const categories: FetchedCategory[] = [];
    for (const category of parseCategories(first.data)) {
      const url =
        `${BASE_URL}/tournament-acceptance-load?csrf_form_token=${next}` +
        `&tour_id=${tourId}&categoryid=${category.categoryId}`;
      const answer = JSON.parse((await this.request(url, { ajax: true, cookie })).body) as {
        status?: boolean;
        token?: string;
        data?: string;
      };
      if (answer.token) next = answer.token;
      categories.push({
        ...category,
        parsed: answer.status && answer.data ? parseAcceptanceCategory(answer.data) : null,
      });
    }
    return { tourId, title, categories };
  }
}
