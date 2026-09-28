import { createHash } from "node:crypto";

import { Opportunity } from "../../shared/models/Opportunity";
import {
  SourceWatch,
  needsAttention,
  type SourceWatchDocument,
  type SourceWatchStatus,
} from "../../shared/models/SourceWatch";
import { htmlToText, resolveSafeHttpUrl, stripSiteChrome } from "./dataSourceExtraction/http";
import { getAdminsWithPermission, resolveAdminAppUrl } from "./AdminService";
import { sendOpportunityWatchDigestEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-watch");

// ─── The weekly source watch ────────────────────────────────────────────────
//
// Every URL an admission or scholarship entry cites, plus the pages where its
// next circular will appear, fetched once a week. No AI and no page storage:
// each URL is reduced to a status and two fingerprints (its readable text, and
// the list of documents it links to), compared with last week's, and anything
// that changed or cannot be read is flagged for a person and emailed once.
//
// A fetch that fails is never read as "nothing changed". Blocked, moved and
// gone are their own statuses with their own advice, because the server's own
// network is the only honest test of what it can read: the first run doubles
// as the readability report for every source.
//
// Polite by construction: robots.txt is honoured, requests are sequential with
// a pause between them, and each URL is fetched once a week.

const USER_AGENT =
  "Mozilla/5.0 (compatible; PowerMySportSourceCheck/1.0; +https://powermysport.com) weekly source check";
const FETCH_TIMEOUT_MS = 25_000;
const PAUSE_BETWEEN_REQUESTS_MS = 1_500;
/** Bodies above this are not worth hashing in full for change detection. */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

// ─── robots.txt ──────────────────────────────────────────────────────────────

/**
 * Whether `path` may be fetched under the `User-agent: *` rules of a
 * robots.txt. Longest matching rule wins, Allow beating Disallow on a tie, as
 * the major crawlers do. Wildcards inside rules are not supported and such a
 * rule is ignored, which errs towards fetching a public page once a week.
 */
export function robotsAllows(robotsTxt: string, path: string): boolean {
  const rules: Array<{ allow: boolean; prefix: string }> = [];
  let inStarGroup = false;
  let sawRuleInGroup = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const key = field!.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      // Consecutive user-agent lines share a group; a new one after rules starts one.
      if (sawRuleInGroup) {
        inStarGroup = false;
        sawRuleInGroup = false;
      }
      if (value === "*") inStarGroup = true;
      continue;
    }
    if (key === "allow" || key === "disallow") {
      sawRuleInGroup = true;
      if (!inStarGroup || value.includes("*")) continue;
      if (key === "disallow" && value === "") continue; // "Disallow:" allows everything
      rules.push({ allow: key === "allow", prefix: value.replace(/\$$/, "") });
    }
  }
  let best: { allow: boolean; prefix: string } | null = null;
  for (const rule of rules) {
    if (!path.startsWith(rule.prefix)) continue;
    if (
      !best ||
      rule.prefix.length > best.prefix.length ||
      (rule.prefix.length === best.prefix.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

// ─── Classifying one fetch ───────────────────────────────────────────────────

export interface CheckResult {
  status: SourceWatchStatus;
  httpStatus?: number;
  finalUrl?: string;
  contentType?: string;
  note?: string;
  fingerprint?: string;
  linkFingerprint?: string;
  documentLinkCount?: number;
  kind?: "pdf" | "html";
}

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const FILE_URL = /\.(pdf|docx?|xlsx?)(\?|#|$)/i;
const DOCUMENT_HREF = /href\s*=\s*["']([^"']+\.(?:pdf|docx?|xlsx?)(?:\?[^"']*)?)["']/gi;

/**
 * Lines that change on every visit without the page's substance changing:
 * visitor counters, "last updated" stamps, copyright years. Left in, they
 * would flag every page every week and teach everyone to ignore the flag.
 */
const NOISE_LINE = /(visitors?|hits|page views|last (updated|modified|reviewed)|©|copyright)/i;

export function normaliseText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !NOISE_LINE.test(line))
    .join("\n")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The documents a page links to, absolute and sorted, so their set can be compared week to week. */
export function documentLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(DOCUMENT_HREF)) {
    try {
      links.add(new URL(match[1]!.trim(), baseUrl).toString());
    } catch {
      // A malformed href is not a document we can follow anyway.
    }
  }
  return [...links].sort();
}

/** Turn one HTTP response into a status and fingerprints. Pure, apart from reading the body. */
export function classifyResponse(input: {
  requestedUrl: string;
  httpStatus: number;
  finalUrl: string;
  contentType: string;
  body: Buffer;
}): CheckResult {
  const { requestedUrl, httpStatus, finalUrl, contentType, body } = input;
  const base = { httpStatus, finalUrl, contentType };

  if (httpStatus === 404 || httpStatus === 410) {
    return { ...base, status: "gone", note: "The page no longer exists. Find where it moved." };
  }
  if ([401, 403, 429, 451, 503].includes(httpStatus)) {
    return {
      ...base,
      status: "blocked",
      note: "The site refused our server. Download the document and upload it by hand.",
    };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ...base, status: "error", note: `The site answered with HTTP ${httpStatus}.` };
  }

  const isPdf = /application\/pdf/i.test(contentType);
  if (FILE_URL.test(requestedUrl) && !isPdf && !/officedocument|msword|excel/i.test(contentType)) {
    return {
      ...base,
      status: "moved",
      note: "This link used to be a file and now leads to a page. The document has moved; find its new address.",
    };
  }
  if (isPdf || /officedocument|msword|excel/i.test(contentType)) {
    return { ...base, status: "ok", kind: "pdf", fingerprint: sha256(body) };
  }

  const html = body.toString("utf8");
  const text = normaliseText(htmlToText(stripSiteChrome(html), finalUrl));
  const words = text ? text.split(" ").length : 0;
  if (words < 150 && body.length < 4_096) {
    return {
      ...base,
      status: "blocked",
      note: "The site answered with an almost empty page: a bot check, or a page built in the browser. Upload the document by hand.",
    };
  }
  const links = documentLinks(html, finalUrl);
  return {
    ...base,
    status: "ok",
    kind: "html",
    fingerprint: sha256(text),
    linkFingerprint: sha256(links.join("\n")),
    documentLinkCount: links.length,
  };
}

// ─── Comparing with last week ────────────────────────────────────────────────

export interface Evaluation {
  /** First readable fetch: recorded as the baseline, not reported as a change. */
  baseline: boolean;
  changed: boolean;
  changeKind?: "documents" | "text" | "file";
  /** The status is different from last time, which starts a new problem or ends one. */
  statusChanged: boolean;
}

export function evaluate(
  previous: Pick<SourceWatchDocument, "status" | "fingerprint" | "linkFingerprint"> | null,
  next: CheckResult
): Evaluation {
  const statusChanged = !previous || previous.status !== next.status;
  if (next.status !== "ok") return { baseline: false, changed: false, statusChanged };
  if (!previous?.fingerprint) return { baseline: true, changed: false, statusChanged };
  if (next.kind === "pdf") {
    const changed = previous.fingerprint !== next.fingerprint;
    return { baseline: false, changed, ...(changed ? { changeKind: "file" } : {}), statusChanged };
  }
  if (previous.linkFingerprint && previous.linkFingerprint !== next.linkFingerprint) {
    return { baseline: false, changed: true, changeKind: "documents", statusChanged };
  }
  if (previous.fingerprint !== next.fingerprint) {
    return { baseline: false, changed: true, changeKind: "text", statusChanged };
  }
  return { baseline: false, changed: false, statusChanged };
}

// ─── Fetching ────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkUrl(
  url: string,
  deps: {
    fetchImpl: FetchLike;
    resolveUrl: (raw: string) => Promise<string | null>;
    robotsFor: (origin: string) => Promise<string | null>;
  }
): Promise<CheckResult> {
  const safe = await deps.resolveUrl(url);
  if (!safe) {
    return {
      status: "error",
      note: "The address could not be resolved, or points somewhere we will not fetch.",
    };
  }
  const parsed = new URL(safe);
  const robots = await deps.robotsFor(parsed.origin);
  if (robots && !robotsAllows(robots, `${parsed.pathname}${parsed.search}`)) {
    return {
      status: "disallowed",
      note: "The site's robots.txt asks crawlers not to fetch this. Check it by hand.",
    };
  }
  try {
    const res = await deps.fetchImpl(safe, {
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/pdf,*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const declared = Number(res.headers.get("content-length") ?? "0");
    const body = declared > MAX_BODY_BYTES ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
    return classifyResponse({
      requestedUrl: url,
      httpStatus: res.status,
      finalUrl: res.url || safe,
      contentType: res.headers.get("content-type") ?? "",
      body,
    });
  } catch (err) {
    const message = (err as Error).message ?? "";
    return {
      status: "error",
      note: /timeout|aborted/i.test(message)
        ? "The site did not answer within 25 seconds."
        : "The request failed before the site answered.",
    };
  }
}

// ─── The run ─────────────────────────────────────────────────────────────────

export interface WatchedUrl {
  url: string;
  entries: Array<{ id: string; slug: string; title: string; status: string }>;
}

/** Every URL any entry depends on, with the entries that depend on it. */
export async function collectWatchTargets(): Promise<WatchedUrl[]> {
  const docs = await Opportunity.find({}).select("slug title status sources.url watchUrls").lean();
  const byUrl = new Map<string, WatchedUrl>();
  for (const doc of docs) {
    const urls = new Set([...(doc.sources ?? []).map((s) => s.url), ...(doc.watchUrls ?? [])]);
    for (const url of urls) {
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const entry = { id: String(doc._id), slug: doc.slug, title: doc.title, status: doc.status };
      const existing = byUrl.get(url);
      if (existing) existing.entries.push(entry);
      else byUrl.set(url, { url, entries: [entry] });
    }
  }
  return [...byUrl.values()];
}

export interface WatchRunSummary {
  checked: number;
  ok: number;
  changed: number;
  unreadable: number;
  firstRun: boolean;
  emailed: number;
}

export interface DigestItem {
  url: string;
  status: SourceWatchStatus;
  note?: string;
  changeKind?: string;
  entries: string[];
}

let running = false;
export const isWatchRunning = () => running;

/**
 * Check every watched URL once, record what changed, and email the editors
 * about anything new: a change, or a source that stopped being readable. A
 * problem already reported is not emailed again every week; it stays flagged
 * in admin until someone acknowledges it.
 */
export async function runOpportunityWatch(
  deps: {
    fetchImpl?: FetchLike;
    resolveUrl?: (raw: string) => Promise<string | null>;
    pauseMs?: number;
    notify?: boolean;
  } = {}
): Promise<WatchRunSummary> {
  if (running) throw new Error("A source check is already running.");
  running = true;
  try {
    const fetchImpl = deps.fetchImpl ?? ((url, init) => fetch(url, init));
    const resolveUrl = deps.resolveUrl ?? resolveSafeHttpUrl;
    const pauseMs = deps.pauseMs ?? PAUSE_BETWEEN_REQUESTS_MS;

    const robotsCache = new Map<string, string | null>();
    const robotsFor = async (origin: string) => {
      if (robotsCache.has(origin)) return robotsCache.get(origin)!;
      let text: string | null = null;
      try {
        const res = await fetchImpl(`${origin}/robots.txt`, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok && /text\/plain/i.test(res.headers.get("content-type") ?? "text/plain")) {
          text = await res.text();
        }
      } catch {
        text = null; // No robots.txt reachable: nothing asks us not to.
      }
      robotsCache.set(origin, text);
      return text;
    };

    const targets = await collectWatchTargets();
    const firstRun = (await SourceWatch.estimatedDocumentCount()) === 0;
    const now = new Date();
    const report: DigestItem[] = [];
    let ok = 0;
    let changed = 0;
    let unreadable = 0;

    for (const [index, target] of targets.entries()) {
      if (index > 0 && pauseMs > 0) await sleep(pauseMs);
      const result = await checkUrl(target.url, { fetchImpl, resolveUrl, robotsFor });
      const previous = await SourceWatch.findOne({ url: target.url });
      const verdict = evaluate(previous, result);

      if (result.status === "ok") ok += 1;
      else unreadable += 1;
      if (verdict.changed) changed += 1;

      const update: Record<string, unknown> = {
        status: result.status,
        httpStatus: result.httpStatus,
        finalUrl: result.finalUrl,
        contentType: result.contentType,
        note: result.note,
        lastCheckedAt: now,
        ...(verdict.statusChanged ? { statusSince: now } : {}),
      };
      if (result.status === "ok") {
        // A failed fetch keeps the last good fingerprints, so the next good
        // one is compared with what was actually there, not with nothing.
        update.fingerprint = result.fingerprint;
        update.linkFingerprint = result.linkFingerprint;
        update.documentLinkCount = result.documentLinkCount;
        update.lastOkAt = now;
      }
      if (verdict.changed) {
        update.lastChangedAt = now;
        update.changeKind = verdict.changeKind;
      }
      await SourceWatch.updateOne(
        { url: target.url },
        { $set: update, $setOnInsert: { firstCheckedAt: now } },
        { upsert: true }
      );

      const newProblem = result.status !== "ok" && (verdict.statusChanged || firstRun);
      if (verdict.changed || newProblem) {
        report.push({
          url: target.url,
          status: result.status,
          ...(result.note ? { note: result.note } : {}),
          ...(verdict.changeKind ? { changeKind: verdict.changeKind } : {}),
          entries: target.entries.map((e) => e.title),
        });
      }
    }

    // URLs no entry cites any more are not ours to keep checking.
    await SourceWatch.deleteMany({ url: { $nin: targets.map((t) => t.url) } });

    let emailed = 0;
    if (deps.notify !== false && (report.length > 0 || firstRun) && targets.length > 0) {
      emailed = await sendDigest(report, {
        firstRun,
        checked: targets.length,
        ok,
        unreadable,
      });
    }

    const summary = { checked: targets.length, ok, changed, unreadable, firstRun, emailed };
    log.info("Source check finished", summary);
    return summary;
  } finally {
    running = false;
  }
}

async function sendDigest(
  items: DigestItem[],
  totals: { firstRun: boolean; checked: number; ok: number; unreadable: number }
): Promise<number> {
  try {
    const editors = await getAdminsWithPermission("opportunities:manage");
    const reviewUrl = `${resolveAdminAppUrl()}/admin/opportunities`;
    await Promise.all(
      editors.map((admin) =>
        sendOpportunityWatchDigestEmail({
          to: admin.email,
          name: admin.name,
          items,
          reviewUrl,
          ...totals,
        })
      )
    );
    return editors.length;
  } catch (error) {
    log.error("Could not email the source check digest:", error);
    return 0;
  }
}

/** Watches with their entries and whether each needs a person, for the admin screen. */
export async function listWatches() {
  const [watches, targets] = await Promise.all([
    SourceWatch.find({}).sort({ lastCheckedAt: -1 }).lean(),
    collectWatchTargets(),
  ]);
  const entriesByUrl = new Map(targets.map((t) => [t.url, t.entries]));
  return watches.map((watch) => ({
    ...watch,
    _id: String(watch._id),
    entries: entriesByUrl.get(watch.url) ?? [],
    needsAttention: needsAttention(watch),
  }));
}

/** A person has looked: quiet this URL until it changes again. */
export async function acknowledgeWatchUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await SourceWatch.updateMany({ url: { $in: urls } }, { $set: { acknowledgedAt: new Date() } });
}
