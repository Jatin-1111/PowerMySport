#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           PowerMySport — Production Load Test Script  (v2)           ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Target  : Elastic Beanstalk (powermysport-api-docker)               ║
 * ║  Region  : ap-south-1 (Mumbai)                                       ║
 * ║  Instance: t3.medium  (Min: 1 / Max: 4 — Auto Scaling)               ║
 * ║  LB Type : Application Load Balancer (ALB)                           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * WHAT CHANGED vs v1 (and why it matters for a real prod test):
 *   • Open-loop arrival model with NO timer drift. Requests are anchored to
 *     absolute scheduled times, so target RPS is actually maintained. If the
 *     event loop stalls, the scheduler catches up instead of silently drifting.
 *   • Coordinated-omission correction. Latency is measured from the time a
 *     request was SUPPOSED to fire, not from when it actually fired. When the
 *     server slows, this surfaces the real user-visible latency instead of
 *     hiding it (v1 under-reported latency exactly when the server struggled).
 *   • Backpressure accounting. When in-flight hits the cap, the missed arrival
 *     is COUNTED (not silently skipped) so you can see the server can't keep up.
 *   • Staged ramp (--stages) to find the breaking point, plus --warmup.
 *   • Bounded-memory latency via a compact log histogram (safe for long runs).
 *   • Per-second time series + sparklines + optional JSON/CSV export.
 *   • Network errors categorised (timeout / reset / refused / dns / hangup).
 *   • Optional undici connection pool (auto-detected) + keep-alive control.
 *   • Graceful Ctrl-C: prints the partial report instead of dying silently.
 *
 * Usage:
 *   node load-test.mjs [options]
 *
 *   --rps <n>          Requests per second to fire          (default: 50)
 *   --duration <s>     Test duration in seconds             (default: 30)
 *   --warmup <s>       Warmup seconds (stats discarded)     (default: 0)
 *   --stages <spec>    Ramp stages "rps:sec,rps:sec,..."    (overrides rps/duration)
 *                        e.g. --stages "50:30,100:30,200:60,400:60"
 *   --max-inflight <n> Cap on concurrent in-flight requests (default: rps*4)
 *   --pool <n>         Connection pool size (undici)        (default: max-inflight)
 *   --no-keepalive     Send Connection: close (cold-conn cost test)
 *   --timeout <ms>     Per-request timeout                  (default: 10000)
 *   --url <url>        Override base URL
 *   --scenario <name>  health | public | mixed | venues | discovery (default: mixed)
 *   --count-429 <mode> success | failure  (treat 429 as) (default: success)
 *   --out <file.json>  Write full machine-readable results
 *   --csv <file.csv>   Write per-second time series
 *   --no-eb            Skip the AWS Elastic Beanstalk status lookup
 *
 * Examples:
 *   node load-test.mjs --rps 100 --duration 30 --warmup 5
 *   node load-test.mjs --stages "50:20,100:20,200:30,400:30" --scenario venues
 *   node load-test.mjs --rps 200 --duration 60 --out run.json --csv run.csv
 */

import { performance } from "perf_hooks";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync } from "fs";

const execAsync = promisify(exec);

// ─── Config ────────────────────────────────────────────────────────────────
const BASE_URL = "https://api.powermysport.com";
// const BASE_URL = "http://localhost:5000";

const args = parseArgs(process.argv.slice(2));
const RPS = parseInt(args["--rps"] ?? "50");
const DURATION_SEC = parseInt(args["--duration"] ?? "30");
const WARMUP_SEC = parseInt(args["--warmup"] ?? "0");
const TARGET_URL = args["--url"] ?? BASE_URL;
const SCENARIO = args["--scenario"] ?? "mixed";
const TIMEOUT_MS = parseInt(args["--timeout"] ?? "10000");
const KEEPALIVE = args["--no-keepalive"] === undefined; // flag presence disables
const COUNT_429_AS = (args["--count-429"] ?? "success").toLowerCase(); // success|failure
const OUT_JSON = typeof args["--out"] === "string" ? args["--out"] : null;
const OUT_CSV = typeof args["--csv"] === "string" ? args["--csv"] : null;
const SKIP_EB = args["--no-eb"] !== undefined;

// Stages: explicit ramp, or a single stage from --rps/--duration.
// A warmup stage (if any) is prepended and flagged so its stats are discarded.
const STAGES = parseStages(args["--stages"], RPS, DURATION_SEC, WARMUP_SEC);
const PEAK_RPS = Math.max(...STAGES.map((s) => s.rps));
const TOTAL_SEC = STAGES.reduce((s, st) => s + st.sec, 0);

// in-flight cap models how much queue we tolerate before declaring backpressure.
const MAX_INFLIGHT = parseInt(args["--max-inflight"] ?? String(Math.max(PEAK_RPS * 4, 64)));
const POOL_SIZE = parseInt(args["--pool"] ?? String(MAX_INFLIGHT));

// ─── Optional undici connection pool (zero hard dependency) ──────────────────
// Node's global fetch does not let you size its connection pool without undici.
// We use it if it's installed; otherwise we fall back to default fetch cleanly.
let UNDICI = "default fetch (no pool control)";
try {
  const { Agent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(
    new Agent({
      connections: POOL_SIZE,
      pipelining: 1,
      keepAliveTimeout: KEEPALIVE ? 30_000 : 1,
      keepAliveMaxTimeout: KEEPALIVE ? 60_000 : 1,
      connect: { timeout: Math.min(TIMEOUT_MS, 10_000) },
    })
  );
  UNDICI = `undici Agent (pool=${POOL_SIZE}, keep-alive=${KEEPALIVE ? "on" : "off"})`;
} catch {
  // undici not available — fine, default fetch still works.
}

// ─── Endpoint Scenarios ─────────────────────────────────────────────────────
// (unchanged route audit + scenarios from v1)
const ENDPOINTS = {
  health: [{ path: "/api/health", weight: 1, method: "GET", label: "Health" }],

  public: [
    { path: "/api/health", weight: 2, method: "GET", label: "Health" },
    { path: "/api/sports", weight: 4, method: "GET", label: "Sports List" },
    { path: "/api/sports/search?q=cricket", weight: 2, method: "GET", label: "Sports Search" },
    { path: "/api/venues", weight: 5, method: "GET", label: "Venues List" },
    { path: "/api/venues?page=1&limit=10", weight: 4, method: "GET", label: "Venues (p1)" },
    { path: "/api/venues?page=2&limit=10", weight: 2, method: "GET", label: "Venues (p2)" },
    { path: "/api/venues/search?q=football", weight: 2, method: "GET", label: "Venues Search" },
    { path: "/api/venues/discover?lat=28.6&lng=77.2", weight: 2, method: "GET", label: "Venues Discover" },
    { path: "/api/coaches/discover?lat=28.6&lng=77.2", weight: 2, method: "GET", label: "Coaches Discover" },
    { path: "/api/v1/products", weight: 3, method: "GET", label: "Shop Products" },
  ],

  mixed: [
    { path: "/api/health", weight: 3, method: "GET", label: "Health" },
    { path: "/api/sports", weight: 4, method: "GET", label: "Sports List" },
    { path: "/api/sports/search?q=cricket", weight: 2, method: "GET", label: "Sports Search" },
    { path: "/api/venues", weight: 5, method: "GET", label: "Venues List" },
    { path: "/api/venues?page=1&limit=10", weight: 4, method: "GET", label: "Venues (p1)" },
    { path: "/api/venues?page=2&limit=10", weight: 2, method: "GET", label: "Venues (p2)" },
    { path: "/api/venues/search?q=football", weight: 2, method: "GET", label: "Venues Search" },
    { path: "/api/venues/discover?lat=28.6&lng=77.2", weight: 3, method: "GET", label: "Venues Discover" },
    { path: "/api/coaches/discover?lat=28.6&lng=77.2", weight: 3, method: "GET", label: "Coaches Discover" },
    { path: "/api/v1/products", weight: 2, method: "GET", label: "Shop Products" },
  ],

  venues: [
    { path: "/api/venues", weight: 5, method: "GET", label: "Venues List" },
    { path: "/api/venues?page=1&limit=10", weight: 4, method: "GET", label: "Venues (p1)" },
    { path: "/api/venues?page=2&limit=10", weight: 3, method: "GET", label: "Venues (p2)" },
    { path: "/api/venues?page=3&limit=10", weight: 2, method: "GET", label: "Venues (p3)" },
    { path: "/api/venues/search?q=cricket", weight: 3, method: "GET", label: "Venues Search (cricket)" },
    { path: "/api/venues/search?q=football", weight: 3, method: "GET", label: "Venues Search (football)" },
    { path: "/api/venues/discover?lat=28.6&lng=77.2", weight: 3, method: "GET", label: "Venues Discover (Delhi)" },
    { path: "/api/venues/discover?lat=19.0&lng=72.8", weight: 2, method: "GET", label: "Venues Discover (Mumbai)" },
  ],

  discovery: [
    { path: "/api/venues/discover?lat=28.6&lng=77.2", weight: 5, method: "GET", label: "Venues (Delhi)" },
    { path: "/api/venues/discover?lat=19.0&lng=72.8", weight: 4, method: "GET", label: "Venues (Mumbai)" },
    { path: "/api/venues/discover?lat=12.9&lng=77.6", weight: 3, method: "GET", label: "Venues (Bangalore)" },
    { path: "/api/coaches/discover?lat=28.6&lng=77.2", weight: 5, method: "GET", label: "Coaches (Delhi)" },
    { path: "/api/coaches/discover?lat=19.0&lng=72.8", weight: 4, method: "GET", label: "Coaches (Mumbai)" },
    { path: "/api/coaches/discover?lat=12.9&lng=77.6", weight: 3, method: "GET", label: "Coaches (Bangalore)" },
  ],
};

// ─── ANSI Colors ────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", blue: "\x1b[34m", magenta: "\x1b[35m", white: "\x1b[37m",
  bgRed: "\x1b[41m", bgGreen: "\x1b[42m", bgYellow: "\x1b[43m",
};

// ─── Compact log histogram (bounded memory, ~2% bucket error) ────────────────
// Keeps percentiles accurate enough for load testing without storing every
// sample. v1 pushed every latency into growing arrays — at 400 rps × 120s that
// is ~48k entries per endpoint and sorting them all at the end. This is O(1) mem.
const SUBS = 32; // sub-buckets per power of two → ~2.2% relative spacing
class Hist {
  constructor() { this.buckets = new Map(); this.count = 0; this.sum = 0; this.min = Infinity; this.max = 0; }
  record(v) {
    if (v < 0) v = 0;
    this.count++; this.sum += v;
    if (v < this.min) this.min = v;
    if (v > this.max) this.max = v;
    const idx = v <= 0 ? 0 : Math.floor(Math.log2(v) * SUBS);
    this.buckets.set(idx, (this.buckets.get(idx) ?? 0) + 1);
  }
  percentile(p) {
    if (this.count === 0) return 0;
    const target = (p / 100) * this.count;
    const keys = [...this.buckets.keys()].sort((a, b) => a - b);
    let cum = 0;
    for (const k of keys) {
      cum += this.buckets.get(k);
      if (cum >= target) {
        // representative value at bucket midpoint
        return Math.round(Math.pow(2, (k + 0.5) / SUBS));
      }
    }
    return Math.round(this.max);
  }
  get mean() { return this.count ? Math.round(this.sum / this.count) : 0; }
  get minVal() { return this.count ? Math.round(this.min) : 0; }
  get maxVal() { return Math.round(this.max); }
}

// ─── State ──────────────────────────────────────────────────────────────────
const stats = {
  total: 0, succeeded: 0, failed: 0, rateLimited: 0, timedOut: 0,
  backpressure: 0,            // arrivals we could not fire (in-flight cap hit)
  byStatus: {},
  byEndpoint: {},             // label -> {total, succeeded, failed, limited, svc:Hist, co:Hist}
  errKinds: {},               // categorised network errors
  svc: new Hist(),            // service latency (send → response)
  co: new Hist(),             // coordinated-omission-corrected (scheduled → response)
  series: [],                 // per-second snapshots
  errors: [],                 // small sample of error details
  startTime: null, endTime: null,
};

const envDetails = {
  Environment: "Unknown", Instance: "Unknown", AutoScaling: "Unknown",
  LoadBalancer: "Unknown", Region: "Unknown", Health: "Unknown",
  Status: "Unknown", Platform: "Unknown", CNAME: "Unknown",
};

let inFlight = 0;
let stopped = false;
let measuring = true; // false during warmup

// ─── Weighted random endpoint picker ────────────────────────────────────────
const endpoints = ENDPOINTS[SCENARIO] ?? ENDPOINTS.mixed;
const totalWeight = endpoints.reduce((s, e) => s + e.weight, 0);

function pickEndpoint() {
  let r = Math.random() * totalWeight;
  for (const ep of endpoints) {
    r -= ep.weight;
    if (r <= 0) return ep;
  }
  return endpoints[endpoints.length - 1];
}

// ─── Error categorisation ────────────────────────────────────────────────────
function classifyError(err) {
  if (err?.name === "AbortError" || /abort/i.test(err?.message ?? "")) return "TIMEOUT";
  const code = err?.cause?.code ?? err?.code ?? "";
  const msg = (err?.message ?? "") + " " + (err?.cause?.message ?? "");
  if (code === "ECONNREFUSED") return "CONN_REFUSED";
  if (code === "ECONNRESET" || /socket hang up/i.test(msg)) return "CONN_RESET";
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return "CONN_TIMEOUT";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS";
  if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") return "TIMEOUT";
  return "OTHER";
}

// ─── Single request ───────────────────────────────────────────────────────
// scheduledAt = the performance.now() time this request was MEANT to fire.
// We measure service latency (now - sentAt) AND corrected latency (now - scheduledAt).
async function fireRequest(scheduledAt) {
  const ep = pickEndpoint();
  const url = `${TARGET_URL}${ep.path}`;
  const label = ep.label;

  const rec = measuring; // capture: should this request count toward stats?
  if (rec && !stats.byEndpoint[label]) {
    stats.byEndpoint[label] = { total: 0, succeeded: 0, failed: 0, limited: 0, svc: new Hist(), co: new Hist() };
  }
  if (rec) { stats.total++; stats.byEndpoint[label].total++; }
  inFlight++;

  const sentAt = performance.now();
  const headers = { Accept: "application/json", "User-Agent": "PowerMySport-LoadTest/2.0" };
  if (!KEEPALIVE) headers["Connection"] = "close";

  try {
    const res = await fetch(url, {
      method: ep.method,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers,
    });
    // drain body so the connection can be reused and we measure full TTLB-ish cost
    await res.arrayBuffer().catch(() => {});

    const svcMs = performance.now() - sentAt;
    const coMs = performance.now() - scheduledAt;

    if (rec) {
      const sk = String(res.status);
      stats.byStatus[sk] = (stats.byStatus[sk] ?? 0) + 1;
      stats.svc.record(svcMs); stats.co.record(coMs);
      const eb = stats.byEndpoint[label];
      eb.svc.record(svcMs); eb.co.record(coMs);

      const is429 = res.status === 429;
      const ok = res.ok || (is429 && COUNT_429_AS === "success");
      if (is429) { stats.rateLimited++; eb.limited++; }
      if (ok) { stats.succeeded++; eb.succeeded++; }
      else {
        stats.failed++; eb.failed++;
        if (!is429 && stats.errors.length < 25) stats.errors.push({ url, status: res.status, latencyMs: Math.round(svcMs) });
      }
    }
  } catch (err) {
    const svcMs = performance.now() - sentAt;
    const coMs = performance.now() - scheduledAt;
    const kind = classifyError(err);
    if (rec) {
      stats.failed++;
      stats.svc.record(svcMs); stats.co.record(coMs);
      stats.errKinds[kind] = (stats.errKinds[kind] ?? 0) + 1;
      if (kind === "TIMEOUT") stats.timedOut++;
      const eb = stats.byEndpoint[label];
      if (eb) { eb.failed++; eb.svc.record(svcMs); eb.co.record(coMs); }
      if (stats.errors.length < 25) stats.errors.push({ url, error: kind, latencyMs: Math.round(svcMs) });
    }
  } finally {
    inFlight--;
  }
}

function avgArr(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0; }

// ─── Sparkline ───────────────────────────────────────────────────────────────
function sparkline(values) {
  const ticks = "▁▂▃▄▅▆▇█";
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  return values.map((v) => ticks[Math.min(ticks.length - 1, Math.floor((v / max) * (ticks.length - 1)))]).join("");
}

// ─── Live Progress Bar ───────────────────────────────────────────────────────
function drawProgress(elapsed, total, phaseLabel, liveRps) {
  const pct = Math.min(elapsed / total, 1);
  const barLen = 26;
  const filled = Math.round(pct * barLen);
  const bar = C.green + "█".repeat(filled) + C.dim + "░".repeat(barLen - filled) + C.reset;
  const denom = stats.succeeded + stats.failed;
  const sr = denom > 0 ? ((stats.succeeded / denom) * 100).toFixed(1) : "—";
  const srCol = parseFloat(sr) >= 99 ? C.green : parseFloat(sr) >= 95 ? C.yellow : C.red;

  process.stdout.write(
    `\r${C.bold}[${bar}${C.bold}]${C.reset} ` +
    `${C.cyan}${elapsed}s/${total}s${C.reset} ` +
    `${C.dim}${phaseLabel}${C.reset} ` +
    `${C.green}✓${stats.succeeded}${C.reset} ` +
    `${C.red}✗${stats.failed}${C.reset} ` +
    `${C.yellow}⏱${stats.rateLimited}${C.reset} ` +
    `${C.magenta}~${liveRps}rps${C.reset} ` +
    `${srCol}${sr}%${C.reset} ` +
    `${C.dim}inflight:${inFlight} bp:${stats.backpressure}${C.reset}   `
  );
}

// ─── Final Report ────────────────────────────────────────────────────────────
function printReport() {
  const durationSec = ((stats.endTime ?? Date.now()) - stats.startTime) / 1000;
  const actualRps = (stats.total / durationSec).toFixed(1);
  const realFailed = stats.failed;
  const denom = stats.succeeded + realFailed;
  const successPct = denom > 0 ? ((stats.succeeded / denom) * 100).toFixed(2) : "100.00";
  const failPct = denom > 0 ? ((realFailed / denom) * 100).toFixed(2) : "0.00";
  const rlPct = stats.total > 0 ? ((stats.rateLimited / stats.total) * 100).toFixed(2) : "0.00";
  const throughputRps = (stats.succeeded / durationSec).toFixed(1);
  const targetTotal = STAGES.filter((s) => !s.warmup).reduce((a, s) => a + s.rps * s.sec, 0);
  const deliveryPct = targetTotal > 0 ? ((stats.total / targetTotal) * 100).toFixed(1) : "—";

  console.log("\n\n" + "═".repeat(72));
  console.log(`${C.bold}${C.cyan}  ⚡ PowerMySport Load Test — Results${C.reset}`);
  console.log("═".repeat(72));

  // ── Deployment Info ──
  console.log(`\n${C.bold}${C.blue}▸ Deployment Info${C.reset}`);
  console.log(`  Environment  : ${envDetails.Environment}  (${envDetails.Status})`);
  console.log(`  Platform     : ${envDetails.Platform}`);
  console.log(`  Instance     : ${envDetails.Instance}`);
  console.log(`  Auto Scaling : ${envDetails.AutoScaling}`);
  console.log(`  Load Balancer: ${envDetails.LoadBalancer}`);
  console.log(`  Region       : ${envDetails.Region}`);
  console.log(`  Health       : ${envDetails.Health.includes("Green") ? C.green : C.yellow}${envDetails.Health}${C.reset}`);
  console.log(`  CNAME        : ${envDetails.CNAME}`);
  console.log(`  Target URL   : ${TARGET_URL}`);
  console.log(`  HTTP Client  : ${UNDICI}`);

  // ── Test Config ──
  console.log(`\n${C.bold}${C.blue}▸ Test Configuration${C.reset}`);
  console.log(`  Scenario     : ${SCENARIO}`);
  console.log(`  Stages       : ${STAGES.map((s) => `${s.warmup ? "warmup " : ""}${s.rps}rps×${s.sec}s`).join("  →  ")}`);
  console.log(`  Peak RPS     : ${PEAK_RPS}`);
  console.log(`  Max in-flight: ${MAX_INFLIGHT}`);
  console.log(`  Timeout      : ${TIMEOUT_MS}ms   Keep-alive: ${KEEPALIVE ? "on" : "off"}   429→${COUNT_429_AS}`);

  // ── Summary ──
  console.log(`\n${C.bold}${C.blue}▸ Summary  ${C.dim}(warmup excluded)${C.reset}`);
  console.log(`  Total Requests   : ${C.bold}${stats.total}${C.reset}`);
  console.log(`  Requests Served  : ${C.green}${C.bold}${stats.succeeded}${C.reset}  (${successPct}% success rate)`);
  console.log(`  Real Failures    : ${realFailed > 0 ? C.red : C.green}${C.bold}${realFailed}${C.reset}  (${failPct}%)`);
  console.log(`  Rate Limited 429 : ${C.yellow}${C.bold}${stats.rateLimited}${C.reset}  (${rlPct}%) ${C.dim}← counted as ${COUNT_429_AS}${C.reset}`);
  console.log(`  Timed Out        : ${stats.timedOut > 0 ? C.yellow : C.green}${stats.timedOut}${C.reset}`);
  console.log(`  Backpressure     : ${stats.backpressure > 0 ? C.red : C.green}${stats.backpressure}${C.reset}  ${C.dim}← arrivals dropped because in-flight cap was hit${C.reset}`);
  console.log(`  Actual RPS sent  : ${C.magenta}${actualRps}${C.reset}  ${C.dim}(target delivery: ${deliveryPct}%)${C.reset}`);
  console.log(`  Effective RPS    : ${C.cyan}${throughputRps}${C.reset}  ${C.dim}(2xx + accepted 429)${C.reset}`);
  console.log(`  Duration         : ${durationSec.toFixed(1)}s`);

  // ── Latency: service vs coordinated-omission corrected ──
  console.log(`\n${C.bold}${C.blue}▸ Latency (ms)${C.reset}   ${C.dim}service = send→recv  |  corrected = scheduled→recv (real user-felt)${C.reset}`);
  const latColor = (ms) => (ms < 200 ? C.green : ms < 500 ? C.yellow : C.red);
  const row = (name, h) => {
    const p = (q) => h.percentile(q);
    console.log(
      `  ${name.padEnd(11)} ` +
      `min ${latColor(h.minVal)}${String(h.minVal).padStart(5)}${C.reset}  ` +
      `mean ${latColor(h.mean)}${String(h.mean).padStart(5)}${C.reset}  ` +
      `p50 ${latColor(p(50))}${String(p(50)).padStart(5)}${C.reset}  ` +
      `p90 ${latColor(p(90))}${String(p(90)).padStart(5)}${C.reset}  ` +
      `p95 ${latColor(p(95))}${String(p(95)).padStart(5)}${C.reset}  ` +
      `p99 ${latColor(p(99))}${String(p(99)).padStart(5)}${C.reset}  ` +
      `max ${latColor(h.maxVal)}${String(h.maxVal).padStart(5)}${C.reset}`
    );
  };
  if (stats.svc.count > 0) {
    row("service", stats.svc);
    row("corrected", stats.co);
    const gap = stats.co.percentile(99) - stats.svc.percentile(99);
    if (gap > stats.svc.percentile(99) * 0.5 && gap > 50) {
      console.log(`  ${C.yellow}⚠  Large gap between corrected and service p99 (${gap}ms) → requests are queuing; server can't drain at target RPS.${C.reset}`);
    }
  } else {
    console.log("  No latency data");
  }

  // ── Throughput / latency over time ──
  if (stats.series.length > 1) {
    const rpsSeries = stats.series.map((s) => s.rps);
    const p95Series = stats.series.map((s) => s.p95);
    console.log(`\n${C.bold}${C.blue}▸ Over Time  ${C.dim}(per second)${C.reset}`);
    console.log(`  RPS  ${C.magenta}${sparkline(rpsSeries)}${C.reset}  ${C.dim}${Math.min(...rpsSeries)}–${Math.max(...rpsSeries)}${C.reset}`);
    console.log(`  p95  ${C.cyan}${sparkline(p95Series)}${C.reset}  ${C.dim}${Math.min(...p95Series)}–${Math.max(...p95Series)}ms${C.reset}`);
  }

  // ── Status Codes ──
  console.log(`\n${C.bold}${C.blue}▸ HTTP Status Codes${C.reset}`);
  for (const [code, count] of Object.entries(stats.byStatus).sort()) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    const col = code.startsWith("2") ? C.green : code.startsWith("4") ? C.yellow : C.red;
    console.log(`  ${col}${code}${C.reset} : ${String(count).padStart(6)} requests  (${pct}%)`);
  }

  // ── Network error breakdown ──
  if (Object.keys(stats.errKinds).length) {
    console.log(`\n${C.bold}${C.blue}▸ Network Errors${C.reset}`);
    const hint = {
      TIMEOUT: "server too slow / overloaded",
      CONN_RESET: "server dropped connection (often overload / LB)",
      CONN_REFUSED: "no listener — instance down or scaling",
      CONN_TIMEOUT: "TCP connect stalled — saturated",
      DNS: "name resolution failed (client-side)",
      OTHER: "uncategorised",
    };
    for (const [k, n] of Object.entries(stats.errKinds).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${C.red}${k.padEnd(13)}${C.reset} ${String(n).padStart(6)}  ${C.dim}${hint[k] ?? ""}${C.reset}`);
    }
  }

  // ── Per-Endpoint Breakdown ──
  console.log(`\n${C.bold}${C.blue}▸ Per-Endpoint Breakdown${C.reset}`);
  const header = `  ${"Endpoint".padEnd(28)} ${"Total".padStart(6)}  ${"OK".padStart(6)}  ${"Fail".padStart(6)}  ${"429".padStart(5)}  ${"p50".padStart(5)}  ${"p95".padStart(5)}`;
  console.log(C.dim + header + C.reset);
  console.log(C.dim + "  " + "─".repeat(72) + C.reset);
  for (const [label, d] of Object.entries(stats.byEndpoint)) {
    const failCol = d.failed > 0 ? C.red : C.green;
    console.log(
      `  ${label.padEnd(28)} ${String(d.total).padStart(6)}  ` +
      `${C.green}${String(d.succeeded).padStart(6)}${C.reset}  ` +
      `${failCol}${String(d.failed).padStart(6)}${C.reset}  ` +
      `${C.yellow}${String(d.limited).padStart(5)}${C.reset}  ` +
      `${String(d.svc.percentile(50)).padStart(5)}  ${String(d.svc.percentile(95)).padStart(5)}`
    );
  }

  // ── Errors Sample ──
  if (stats.errors.length > 0) {
    console.log(`\n${C.bold}${C.red}▸ Error Sample (first ${stats.errors.length})${C.reset}`);
    for (const e of stats.errors) {
      const detail = e.status ? `HTTP ${e.status}` : e.error;
      console.log(`  ${C.red}✗${C.reset} [${e.latencyMs}ms] ${e.url}  → ${detail}`);
    }
  }

  // ── Verdict ──
  const ok = parseFloat(successPct);
  console.log(`\n${"═".repeat(72)}`);
  if (stats.backpressure > stats.total * 0.02) {
    console.log(`${C.bgYellow}${C.bold}  ⚠️  SATURATED — couldn't sustain target RPS (backpressure). Lower RPS or scale up. ${C.reset}`);
  } else if (realFailed === 0 && stats.timedOut === 0) {
    console.log(`${C.bgGreen}${C.bold}  ✅ EXCELLENT — Zero real errors at target throughput.            ${C.reset}`);
  } else if (ok >= 99.5) {
    console.log(`${C.bgGreen}${C.bold}  ✅ EXCELLENT — Server handled the load with flying colours!      ${C.reset}`);
  } else if (ok >= 95) {
    console.log(`${C.bgYellow}${C.bold}  ⚠️  ACCEPTABLE — Minor failures. Check errors above.             ${C.reset}`);
  } else if (ok >= 80) {
    console.log(`${C.bgYellow}${C.bold}  ⚠️  SOME ISSUES — Check 4xx/5xx errors and routes above.         ${C.reset}`);
  } else {
    console.log(`${C.bgRed}${C.bold}  ❌ DEGRADED  — High failure rate. Server under stress.           ${C.reset}`);
  }
  if (stats.rateLimited > 0) {
    console.log(`${C.dim}  ℹ️  ${stats.rateLimited} requests were rate-limited (429). Ceiling ≈ ${throughputRps} req/s served on this run.${C.reset}`);
  }
  console.log("═".repeat(72) + "\n");

  writeExports(durationSec, { actualRps, throughputRps, successPct, failPct });
}

function writeExports(durationSec, derived) {
  if (OUT_JSON) {
    const pct = (h) => ({ min: h.minVal, mean: h.mean, p50: h.percentile(50), p90: h.percentile(90), p95: h.percentile(95), p99: h.percentile(99), max: h.maxVal });
    const out = {
      target: TARGET_URL, scenario: SCENARIO, stages: STAGES,
      env: envDetails, client: UNDICI,
      durationSec, ...derived,
      total: stats.total, succeeded: stats.succeeded, failed: stats.failed,
      rateLimited: stats.rateLimited, timedOut: stats.timedOut, backpressure: stats.backpressure,
      byStatus: stats.byStatus, errKinds: stats.errKinds,
      latency: { service: pct(stats.svc), corrected: pct(stats.co) },
      byEndpoint: Object.fromEntries(Object.entries(stats.byEndpoint).map(([k, d]) => [k, { total: d.total, succeeded: d.succeeded, failed: d.failed, limited: d.limited, p50: d.svc.percentile(50), p95: d.svc.percentile(95) }])),
      series: stats.series,
      timestamp: new Date().toISOString(),
    };
    try { writeFileSync(OUT_JSON, JSON.stringify(out, null, 2)); console.log(`${C.green}  ✓ Wrote JSON results → ${OUT_JSON}${C.reset}`); }
    catch (e) { console.log(`${C.red}  ✗ Could not write ${OUT_JSON}: ${e.message}${C.reset}`); }
  }
  if (OUT_CSV) {
    const head = "second,rps,ok,fail,limited,p50,p95,inflight\n";
    const body = stats.series.map((s) => `${s.t},${s.rps},${s.ok},${s.fail},${s.limited},${s.p50},${s.p95},${s.inflight}`).join("\n");
    try { writeFileSync(OUT_CSV, head + body + "\n"); console.log(`${C.green}  ✓ Wrote time series CSV → ${OUT_CSV}${C.reset}`); }
    catch (e) { console.log(`${C.red}  ✗ Could not write ${OUT_CSV}: ${e.message}${C.reset}`); }
  }
}

// ─── EB status lookup (unchanged, but skippable) ─────────────────────────────
async function fetchEbStatus() {
  if (SKIP_EB) return;
  console.log(`${C.dim}  Fetching environment status from AWS Elastic Beanstalk...${C.reset}`);
  try {
    const { stdout: statusOut } = await execAsync("eb status", { cwd: ".." });
    const ex = (key) => { const m = statusOut.match(new RegExp(`${key}: (.+)`)); return m ? m[1].trim() : null; };
    const envNameMatch = statusOut.match(/Environment details for: (.+)/);
    if (envNameMatch) envDetails.Environment = envNameMatch[1].trim();
    if (ex("Region")) envDetails.Region = ex("Region");
    if (ex("Health")) envDetails.Health = ex("Health") + (ex("Health") === "Green" ? " ✓" : "");
    if (ex("Status")) envDetails.Status = ex("Status");
    if (ex("Platform")) { const p = ex("Platform"); envDetails.Platform = p.includes("::platform/") ? p.split("::platform/")[1] : p; }
    if (ex("CNAME")) envDetails.CNAME = ex("CNAME");
    try {
      const { stdout: configOut } = await execAsync(`eb config ${envDetails.Environment} --display`, { cwd: ".." });
      const exc = (key) => { const m = configOut.match(new RegExp(`${key}:\\s*(.+)`)); return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null; };
      if (exc("InstanceType")) envDetails.Instance = exc("InstanceType");
      const mn = exc("MinSize"), mx = exc("MaxSize");
      if (mn && mx) envDetails.AutoScaling = `Min ${mn} → Max ${mx} instances`;
      const lb = exc("LoadBalancerType");
      if (lb) envDetails.LoadBalancer = lb === "application" ? "Application LB (ALB)" : lb;
    } catch { /* ignore */ }
    console.log(`${C.green}  ✓ Environment: ${envDetails.Environment} (${envDetails.Health})${C.reset}\n`);
  } catch {
    console.log(`${C.yellow}  ⚠️  Could not fetch live eb status (eb CLI not found / not configured).${C.reset}\n`);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`\n${C.bold}${C.cyan}  ⚡ PowerMySport — Production Load Test v2${C.reset}`);
  console.log(`  ${C.dim}Target : ${TARGET_URL}${C.reset}`);
  console.log(`  ${C.dim}Plan   : ${STAGES.map((s) => `${s.warmup ? "warmup " : ""}${s.rps}rps×${s.sec}s`).join(" → ")}  |  scenario: ${SCENARIO}${C.reset}`);
  console.log(`  ${C.dim}Client : ${UNDICI}${C.reset}\n`);

  await fetchEbStatus();

  // Health gate
  console.log(`${C.dim}  Pinging server...${C.reset}`);
  try {
    const ping = await fetch(`${TARGET_URL}/api/health`, { signal: AbortSignal.timeout(8000) });
    console.log(ping.ok
      ? `${C.green}  ✓ Server is up (${ping.status})${C.reset}\n`
      : `${C.yellow}  ⚠️  Health check returned ${ping.status}. Proceeding anyway.${C.reset}\n`);
  } catch (err) {
    console.log(`${C.red}  ✗ Cannot reach server: ${err.message}${C.reset}\n`);
    process.exit(1);
  }

  stats.startTime = Date.now();
  const t0 = performance.now();

  // Per-second time-series sampler (uses a windowed histogram for p50/p95)
  let lastDone = 0;
  let windowHist = new Hist();
  const origSvcRecord = stats.svc.record.bind(stats.svc);
  stats.svc.record = (v) => { origSvcRecord(v); if (measuring) windowHist.record(v); };

  let secondElapsed = 0;
  const sampler = setInterval(() => {
    secondElapsed++;
    const doneNow = stats.succeeded + stats.failed;
    const rps = doneNow - lastDone;
    lastDone = doneNow;
    if (measuring) {
      stats.series.push({
        t: secondElapsed, rps,
        ok: stats.succeeded, fail: stats.failed, limited: stats.rateLimited,
        p50: windowHist.percentile(50), p95: windowHist.percentile(95),
        inflight: inFlight,
      });
      windowHist = new Hist();
    }
    drawProgress(secondElapsed, TOTAL_SEC, currentPhaseLabel(), rps);
  }, 1000);

  // Open-loop scheduler: anchored to absolute scheduled times, no drift,
  // catches up after stalls, and counts dropped arrivals as backpressure.
  let stageIdx = 0;
  let stageStartMs = 0;            // perf time when current stage began
  let firedInStage = 0;
  let curPhaseLabel = STAGES[0] ? phaseLabel(STAGES[0], 0) : "";

  function phaseLabel(stage, idx) { return `${stage.warmup ? "warmup" : "stage " + (idx + 1)} @${stage.rps}rps`; }
  function currentPhaseLabel() { return curPhaseLabel; }

  await new Promise((resolve) => {
    function tick() {
      if (stopped) return resolve();
      const stage = STAGES[stageIdx];
      if (!stage) return resolve();

      measuring = !stage.warmup;
      curPhaseLabel = phaseLabel(stage, stageIdx);

      const now = performance.now();
      const stageElapsed = now - (stageStartMs || (stageStartMs = now));
      const intervalMs = 1000 / stage.rps;
      const shouldHaveFired = Math.floor(stageElapsed / intervalMs);

      // catch-up loop: fire everything that was due since last tick
      while (firedInStage < shouldHaveFired) {
        const scheduledAt = stageStartMs + firedInStage * intervalMs;
        firedInStage++;
        if (inFlight >= MAX_INFLIGHT) {
          if (measuring) stats.backpressure++;
          continue; // arrival dropped — server can't drain fast enough
        }
        fireRequest(scheduledAt); // fire-and-forget
      }

      // advance stage?
      if (stageElapsed >= stage.sec * 1000) {
        stageIdx++;
        stageStartMs = 0;
        firedInStage = 0;
        if (stageIdx >= STAGES.length) {
          stopped = true;
          const drain = setInterval(() => {
            if (inFlight === 0) { clearInterval(drain); resolve(); }
          }, 50);
          return;
        }
      }

      // tight-ish tick; 1ms keeps high RPS accurate without busy-spinning
      setTimeout(tick, 1);
    }
    tick();
  });

  clearInterval(sampler);
  stats.endTime = Date.now();
  void t0;
  printReport();
}

// ─── SIGINT: print what we have instead of dying silently ────────────────────
process.on("SIGINT", () => {
  if (stopped) process.exit(130);
  stopped = true;
  stats.endTime = Date.now();
  console.log(`\n${C.yellow}  Interrupted — printing partial results...${C.reset}`);
  try { printReport(); } catch { /* ignore */ }
  process.exit(130);
});

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const next = argv[i + 1];
      // boolean flags like --no-keepalive / --no-eb take no value
      if (next === undefined || next.startsWith("--")) { result[argv[i]] = true; }
      else { result[argv[i]] = next; i++; }
    }
  }
  return result;
}

function parseStages(spec, rps, duration, warmup) {
  const stages = [];
  if (warmup > 0) stages.push({ rps, sec: warmup, warmup: true });
  if (typeof spec === "string") {
    for (const part of spec.split(",")) {
      const [r, s] = part.split(":").map((x) => parseInt(x.trim()));
      if (Number.isFinite(r) && Number.isFinite(s) && r > 0 && s > 0) stages.push({ rps: r, sec: s, warmup: false });
    }
  }
  if (stages.filter((s) => !s.warmup).length === 0) stages.push({ rps, sec: duration, warmup: false });
  return stages;
}

main().catch((err) => {
  console.error(`\n${C.red}Fatal: ${err.message}${C.reset}`);
  process.exit(1);
});
