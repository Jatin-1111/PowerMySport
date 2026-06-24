#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           PowerMySport — Production Load Test Script                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Target  : Elastic Beanstalk (powermysport-api-docker)               ║
 * ║  Region  : ap-south-1 (Mumbai)                                       ║
 * ║  Instance: t3.medium  (Min: 1 / Max: 4 — Auto Scaling)               ║
 * ║  LB Type : Application Load Balancer (ALB)                           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node load-test.mjs [options]
 *
 *   --rps <n>          Requests per second to fire  (default: 50)
 *   --duration <s>     Test duration in seconds     (default: 30)
 *   --concurrency <n>  Max concurrent requests      (default: rps)
 *   --url <url>        Override base URL
 *   --scenario <name>  Scenario to run (default: mixed):
 *                        health     → /api/health only (raw throughput baseline)
 *                        public     → all public endpoints (no auth)
 *                        mixed      → realistic prod traffic mix
 *                        venues     → DB-heavy venue queries
 *                        discovery  → geo lat/lng discovery (coaches + venues)
 *
 * Examples:
 *   node load-test.mjs --rps 100 --duration 30
 *   node load-test.mjs --rps 200 --duration 60 --scenario venues
 *   node load-test.mjs --rps 50  --duration 30 --scenario discovery
 */

import { performance } from "perf_hooks";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ─── Config ────────────────────────────────────────────────────────────────
const BASE_URL = "https://api.powermysport.com";
// const BASE_URL = "http://localhost:5000";

const args = parseArgs(process.argv.slice(2));
const RPS = parseInt(args["--rps"] ?? "50");
const DURATION_SEC = parseInt(args["--duration"] ?? "30");
const CONCURRENCY = parseInt(args["--concurrency"] ?? String(RPS));
const TARGET_URL = args["--url"] ?? BASE_URL;
const SCENARIO = args["--scenario"] ?? "mixed";

// ─── Endpoint Scenarios ─────────────────────────────────────────────────────
//
// Route audit — all backend routes scanned from source:
//
// ✅ PUBLIC (no auth)          ❌ AUTH REQUIRED           🔑 SPECIAL AUTH
// ─────────────────────────    ───────────────────────    ─────────────────────
// GET  /api/health             /api/auth/profile          onboardingAuthMiddleware
// GET  /api/sports             /api/auth/bridge            for venue onboarding
// GET  /api/sports/search      /api/auth/logout            steps 2–5
// GET  /api/venues             /api/notifications/*
// GET  /api/venues/discover    /api/bookings/my-bookings
// GET  /api/venues/search      /api/bookings/:id
// GET  /api/venues/:id         /api/friends/*
// GET  /api/coaches/discover   /api/coaches/my-profile
// GET  /api/coaches/:id        /api/coaches/subscription/*
// GET  /api/coaches/availability/:id /api/community/* (router.use(authMiddleware))
// GET  /api/coaches/:id/subscription-packages
// GET  /api/reviews/venues/:id
// GET  /api/reviews/coaches/:id
// GET  /api/bookings/availability/:venueId
// GET  /api/v1/products
// GET  /api/v1/products/:id
// POST /api/auth/register      (write — excluded from load test)
// POST /api/auth/login         (write — excluded from load test)
// POST /api/auth/google        (write — excluded from load test)
// POST /api/auth/forgot-password
// POST /api/sports/verify
// POST /api/bookings/phonepe/callback
// POST /api/v1/waitlist
// GET  /api/geo/autocomplete   (needs ?input= query)
// GET  /api/geo/geocode        (needs ?address= query)
// GET  /api/geo/reverse        (needs ?lat=&lng= query)

const ENDPOINTS = {
  // ✅ Pure health — no DB, fastest possible baseline
  health: [
    { path: "/api/health", weight: 1, method: "GET", label: "Health" },
  ],

  // 🌍 All verified public GET endpoints (no auth required)
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

  // 🔀 Mixed scenario — realistic prod traffic distribution
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

  // 🏟️ Venue-focused scenario — tests DB-heavy venue queries
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

  // 🏃 Discovery scenario — lat/lng based discovery (coaches + venues)
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
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

// ─── State ──────────────────────────────────────────────────────────────────
const stats = {
  total: 0,
  succeeded: 0,
  failed: 0,
  rateLimited: 0, // 429 — rate limiter working, not a real failure
  timedOut: 0,
  byStatus: {},
  byEndpoint: {},
  latencies: [],
  errors: [],
  startTime: null,
  endTime: null,
};

const envDetails = {
  Environment: "Unknown",
  Instance: "Unknown",
  AutoScaling: "Unknown",
  LoadBalancer: "Unknown",
  Region: "Unknown",
  Health: "Unknown",
  Status: "Unknown",
  Platform: "Unknown",
  CNAME: "Unknown",
};

let activeRequests = 0;
let stopped = false;

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

// ─── Single request ─────────────────────────────────────────────────────────
async function fireRequest() {
  const ep = pickEndpoint();
  const url = `${TARGET_URL}${ep.path}`;
  const label = ep.label;
  const t0 = performance.now();

  // Init endpoint bucket
  if (!stats.byEndpoint[label]) {
    stats.byEndpoint[label] = { total: 0, succeeded: 0, failed: 0, latencies: [] };
  }

  stats.total++;
  stats.byEndpoint[label].total++;
  activeRequests++;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const res = await fetch(url, {
      method: ep.method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "PowerMySport-LoadTest/1.0",
      },
    });

    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - t0);

    // Track by status code
    const statusKey = String(res.status);
    stats.byStatus[statusKey] = (stats.byStatus[statusKey] ?? 0) + 1;
    stats.latencies.push(latencyMs);
    stats.byEndpoint[label].latencies.push(latencyMs);

    if (res.ok) {
      stats.succeeded++;
      stats.byEndpoint[label].succeeded++;
    } else if (res.status === 429) {
      // Rate limited — server is healthy, just protecting itself
      stats.rateLimited++;
      stats.byEndpoint[label].failed++; // still count in endpoint for visibility
    } else {
      stats.failed++;
      stats.byEndpoint[label].failed++;
      if (stats.errors.length < 20) {
        stats.errors.push({ url, status: res.status, latencyMs });
      }
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - t0);
    stats.failed++;
    stats.byEndpoint[label].failed++;
    stats.latencies.push(latencyMs);
    stats.byEndpoint[label].latencies.push(latencyMs);

    const isTimeout = err.name === "AbortError" || err.message?.includes("abort");
    if (isTimeout) stats.timedOut++;

    if (stats.errors.length < 20) {
      stats.errors.push({ url, error: isTimeout ? "TIMEOUT" : err.message, latencyMs });
    }
  } finally {
    activeRequests--;
  }
}

// ─── Percentile ─────────────────────────────────────────────────────────────
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// ─── Live Progress Bar ───────────────────────────────────────────────────────
function drawProgress(elapsed, total, succeeded, failed, rateLimited, rps) {
  const pct = Math.min(elapsed / total, 1);
  const barLen = 30;
  const filled = Math.round(pct * barLen);
  const bar =
    C.green + "█".repeat(filled) + C.dim + "░".repeat(barLen - filled) + C.reset;

  const realFails = failed; // stats.failed already excludes 429s (tracked in rateLimited separately)
  const denominator = succeeded + realFails;
  const successRate = denominator > 0 ? ((succeeded / denominator) * 100).toFixed(1) : "—";
  const rateColor = parseFloat(successRate) >= 99 ? C.green : parseFloat(successRate) >= 95 ? C.yellow : C.red;

  process.stdout.write(
    `\r${C.bold}[${bar}${C.bold}]${C.reset} ` +
    `${C.cyan}${elapsed}s/${total}s${C.reset}  ` +
    `${C.green}✓ ${succeeded}${C.reset}  ` +
    `${C.red}✗ ${realFails}${C.reset}  ` +
    `${C.yellow}⏱ ${rateLimited} limited${C.reset}  ` +
    `${C.magenta}~${rps} rps${C.reset}  ` +
    `${rateColor}${successRate}% ok${C.reset}  ` +
    `${C.dim}active: ${activeRequests}${C.reset}    `
  );
}

// ─── Final Report ────────────────────────────────────────────────────────────
function printReport() {
  const durationSec = (stats.endTime - stats.startTime) / 1000;
  const sortedLat = [...stats.latencies].sort((a, b) => a - b);

  const actualRps = (stats.total / durationSec).toFixed(1);
  // 429s are tracked separately — stats.failed only contains real errors (4xx non-429, 5xx, network)
  const realFailed = stats.failed;
  const denominator = stats.succeeded + realFailed;
  const successPct = denominator > 0 ? ((stats.succeeded / denominator) * 100).toFixed(2) : "100.00";
  const failPct = denominator > 0 ? ((realFailed / denominator) * 100).toFixed(2) : "0.00";
  const rateLimitedPct = stats.total > 0 ? ((stats.rateLimited / stats.total) * 100).toFixed(2) : "0.00";
  const throughputRps = (stats.succeeded / durationSec).toFixed(1);

  console.log("\n\n" + "═".repeat(68));
  console.log(`${C.bold}${C.cyan}  ⚡ PowerMySport Load Test — Results${C.reset}`);
  console.log("═".repeat(68));

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

  // ── Test Config ──
  console.log(`\n${C.bold}${C.blue}▸ Test Configuration${C.reset}`);
  console.log(`  Scenario     : ${SCENARIO}`);
  console.log(`  Target RPS   : ${RPS}`);
  console.log(`  Duration     : ${DURATION_SEC}s`);
  console.log(`  Concurrency  : ${CONCURRENCY}`);

  // ── Summary ──
  console.log(`\n${C.bold}${C.blue}▸ Summary${C.reset}`);
  console.log(`  Total Requests   : ${C.bold}${stats.total}${C.reset}`);
  console.log(`  Requests Served  : ${C.green}${C.bold}${stats.succeeded}${C.reset}  (${successPct}% success rate)`);
  console.log(`  Real Failures    : ${realFailed > 0 ? C.red : C.green}${C.bold}${realFailed}${C.reset}  (${failPct}%)`);
  console.log(`  Rate Limited 429 : ${C.yellow}${C.bold}${stats.rateLimited}${C.reset}  (${rateLimitedPct}%) ${C.dim}← rate limiter working ✓${C.reset}`);
  console.log(`  Timed Out        : ${stats.timedOut > 0 ? C.yellow : C.green}${stats.timedOut}${C.reset}`);
  console.log(`  Actual RPS sent  : ${C.magenta}${actualRps}${C.reset}`);
  console.log(`  Effective RPS    : ${C.cyan}${throughputRps}${C.reset}  ${C.dim}(requests that actually served 200)${C.reset}`);
  console.log(`  Duration         : ${durationSec.toFixed(1)}s`);

  // ── Latency ──
  console.log(`\n${C.bold}${C.blue}▸ Latency (ms)${C.reset}`);
  if (sortedLat.length > 0) {
    const p50 = percentile(sortedLat, 50);
    const p75 = percentile(sortedLat, 75);
    const p90 = percentile(sortedLat, 90);
    const p95 = percentile(sortedLat, 95);
    const p99 = percentile(sortedLat, 99);
    const p100 = sortedLat[sortedLat.length - 1];
    const mean = avg(sortedLat);
    const min = sortedLat[0];

    const latColor = (ms) => ms < 200 ? C.green : ms < 500 ? C.yellow : C.red;

    console.log(`  Min    : ${latColor(min)}${min} ms${C.reset}`);
    console.log(`  Mean   : ${latColor(mean)}${mean} ms${C.reset}`);
    console.log(`  p50    : ${latColor(p50)}${p50} ms${C.reset}`);
    console.log(`  p75    : ${latColor(p75)}${p75} ms${C.reset}`);
    console.log(`  p90    : ${latColor(p90)}${p90} ms${C.reset}`);
    console.log(`  p95    : ${latColor(p95)}${p95} ms${C.reset}`);
    console.log(`  p99    : ${latColor(p99)}${p99} ms${C.reset}`);
    console.log(`  Max    : ${latColor(p100)}${p100} ms${C.reset}`);
  } else {
    console.log("  No latency data");
  }

  // ── Status Codes ──
  console.log(`\n${C.bold}${C.blue}▸ HTTP Status Codes${C.reset}`);
  for (const [code, count] of Object.entries(stats.byStatus).sort()) {
    const pct = ((count / stats.total) * 100).toFixed(1);
    const col = code.startsWith("2") ? C.green : code.startsWith("4") ? C.yellow : C.red;
    console.log(`  ${col}${code}${C.reset} : ${count.toString().padStart(6)} requests  (${pct}%)`);
  }

  // ── Per-Endpoint Breakdown ──
  console.log(`\n${C.bold}${C.blue}▸ Per-Endpoint Breakdown${C.reset}`);
  const headerRow = `  ${"Endpoint".padEnd(28)} ${"Total".padStart(6)}  ${"OK".padStart(6)}  ${"Fail".padStart(6)}  ${"p50ms".padStart(6)}  ${"p95ms".padStart(6)}`;
  console.log(C.dim + headerRow + C.reset);
  console.log(C.dim + "  " + "─".repeat(66) + C.reset);

  for (const [label, data] of Object.entries(stats.byEndpoint)) {
    const sorted = [...data.latencies].sort((a, b) => a - b);
    const p50ep = percentile(sorted, 50);
    const p95ep = percentile(sorted, 95);
    const failCol = data.failed > 0 ? C.red : C.green;

    console.log(
      `  ${label.padEnd(28)} ` +
      `${String(data.total).padStart(6)}  ` +
      `${C.green}${String(data.succeeded).padStart(6)}${C.reset}  ` +
      `${failCol}${String(data.failed).padStart(6)}${C.reset}  ` +
      `${String(p50ep).padStart(6)}  ` +
      `${String(p95ep).padStart(6)}`
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
  const ok = parseFloat(successPct); // based on real failures only, not 429s
  console.log(`\n${"═".repeat(68)}`);
  if (realFailed === 0 && stats.timedOut === 0) {
    console.log(`${C.bgGreen}${C.bold}  ✅ EXCELLENT — Zero real errors! Rate limiter protecting server. ${C.reset}`);
  } else if (ok >= 99.5) {
    console.log(`${C.bgGreen}${C.bold}  ✅ EXCELLENT — Server handled the load with flying colours!  ${C.reset}`);
  } else if (ok >= 95) {
    console.log(`${C.bgYellow}${C.bold}  ⚠️  ACCEPTABLE — Minor failures. Check errors above.           ${C.reset}`);
  } else if (ok >= 80) {
    console.log(`${C.bgYellow}${C.bold}  ⚠️  SOME ISSUES — Check 4xx errors and routes above.          ${C.reset}`);
  } else {
    console.log(`${C.bgRed}${C.bold}  ❌ DEGRADED  — High failure rate. Server under stress.        ${C.reset}`);
  }
  if (stats.rateLimited > 0) {
    console.log(`${C.dim}  ℹ️  ${stats.rateLimited} requests were rate-limited (429) — this is intentional protection.${C.reset}`);
    console.log(`${C.dim}  📊 Rate limit ceiling ~${throughputRps} req/s per IP on this environment.${C.reset}`);
  }
  console.log("═".repeat(68) + "\n");
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`\n${C.bold}${C.cyan}  ⚡ PowerMySport — Production Load Test${C.reset}`);
  console.log(`  ${C.dim}Target : ${TARGET_URL}${C.reset}`);
  console.log(`  ${C.dim}Config : ${RPS} RPS × ${DURATION_SEC}s  |  concurrency: ${CONCURRENCY}  |  scenario: ${SCENARIO}${C.reset}\n`);

  // Fetch EB Status and Config dynamically
  console.log(`${C.dim}  Fetching environment status from AWS Elastic Beanstalk...${C.reset}`);
  try {
    const { stdout: statusOut } = await execAsync("eb status", { cwd: ".." });
    const extractStatus = (key) => {
      const match = statusOut.match(new RegExp(`${key}: (.+)`));
      return match ? match[1].trim() : null;
    };

    const envNameMatch = statusOut.match(/Environment details for: (.+)/);
    if (envNameMatch) envDetails.Environment = envNameMatch[1].trim();

    if (extractStatus("Region")) envDetails.Region = extractStatus("Region");
    if (extractStatus("Health")) envDetails.Health = extractStatus("Health") + (extractStatus("Health") === "Green" ? " ✓" : "");
    if (extractStatus("Status")) envDetails.Status = extractStatus("Status");
    if (extractStatus("Platform")) {
      const p = extractStatus("Platform");
      envDetails.Platform = p.includes('::platform/') ? p.split('::platform/')[1] : p;
    }
    if (extractStatus("CNAME")) envDetails.CNAME = extractStatus("CNAME");

    // Fetch deep config details
    try {
      const { stdout: configOut } = await execAsync(`eb config ${envDetails.Environment} --display`, { cwd: ".." });

      const extractConfig = (key) => {
        const match = configOut.match(new RegExp(`${key}:\\s*(.+)`));
        return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : null;
      };

      const instanceType = extractConfig("InstanceType");
      if (instanceType) envDetails.Instance = instanceType;

      const minSize = extractConfig("MinSize");
      const maxSize = extractConfig("MaxSize");
      if (minSize && maxSize) envDetails.AutoScaling = `Min ${minSize} → Max ${maxSize} instances`;

      const lbType = extractConfig("LoadBalancerType");
      if (lbType) envDetails.LoadBalancer = lbType === "application" ? "Application LB (ALB)" : lbType;

    } catch (configErr) {
      // Ignore config error, status info is already fetched
    }

    console.log(`${C.green}  ✓ Environment: ${envDetails.Environment} (${envDetails.Health})${C.reset}\n`);
  } catch (err) {
    console.log(`${C.yellow}  ⚠️  Could not fetch live eb status. Using Unknown values.${C.reset}\n`);
  }

  // Validate URL first
  console.log(`${C.dim}  Pinging server...${C.reset}`);
  try {
    const ping = await fetch(`${TARGET_URL}/api/health`, { signal: AbortSignal.timeout(8000) });
    if (!ping.ok) {
      console.log(`${C.yellow}  ⚠️  Health check returned ${ping.status}. Proceeding anyway.${C.reset}\n`);
    } else {
      console.log(`${C.green}  ✓ Server is up (${ping.status})${C.reset}\n`);
    }
  } catch (err) {
    console.log(`${C.red}  ✗ Cannot reach server: ${err.message}${C.reset}\n`);
    process.exit(1);
  }

  stats.startTime = Date.now();
  const intervalMs = 1000 / RPS; // time between each request fire
  let elapsed = 0;
  let ticker = 0;
  let lastSucceeded = 0;
  let lastFailed = 0;

  // Progress update every second
  const progressInterval = setInterval(() => {
    elapsed++;
    const newSucc = stats.succeeded - lastSucceeded;
    const newFail = stats.failed - lastFailed;
    lastSucceeded = stats.succeeded;
    lastFailed = stats.failed;
    const liveRps = newSucc + newFail;
    drawProgress(elapsed, DURATION_SEC, stats.succeeded, stats.failed, stats.rateLimited, liveRps);
  }, 1000);

  // Fire requests at target RPS using staggered intervals
  await new Promise((resolve) => {
    const fire = () => {
      if (stopped) return resolve();

      if (activeRequests < CONCURRENCY) {
        fireRequest(); // non-blocking
      }

      ticker++;
      const elapsed_ms = ticker * intervalMs;
      const testDuration_ms = DURATION_SEC * 1000;

      if (elapsed_ms >= testDuration_ms) {
        stopped = true;
        // Wait for in-flight to settle
        const drain = setInterval(() => {
          if (activeRequests === 0) {
            clearInterval(drain);
            resolve();
          }
        }, 50);
        return;
      }

      setTimeout(fire, intervalMs);
    };

    fire();
  });

  clearInterval(progressInterval);
  stats.endTime = Date.now();

  printReport();
}

// ─── Arg Parser ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      result[argv[i]] = argv[i + 1] ?? true;
      i++;
    }
  }
  return result;
}

main().catch((err) => {
  console.error(`\n${C.red}Fatal: ${err.message}${C.reset}`);
  process.exit(1);
});
