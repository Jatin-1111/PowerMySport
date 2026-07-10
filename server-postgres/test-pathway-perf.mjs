#!/usr/bin/env node
/**
 * test-pathway-perf.mjs
 *
 * Hammers POST /api/pathways/refresh for a given sport+state to force a FULL
 * regeneration every run (bypasses cache), and measures wall-clock latency
 * + structural correctness of the parallelized (meta + 5 levels) generation.
 *
 * Usage:
 *   node test-pathway-perf.mjs --base http://localhost:5000 --sport tennis --state Chandigarh --runs 5
 *
 * Flags:
 *   --base   Server base URL (default: http://localhost:5000)
 *   --sport  Sport name           (default: tennis)
 *   --state  Indian state/UT      (default: Chandigarh)
 *   --runs   Number of forced-refresh runs to average over (default: 5)
 *   --out    JSON report output path (default: ./pathway-perf-report.json)
 *
 * NOTE: This measures total wall-clock time only. Per-level model/attempt/
 * latency breakdown is only visible in server logs (the diff added
 * `log.info`/`log.warn` lines per level+meta call) — tail your server logs
 * during the run to see which specific level/model is the slow one.
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith("--")) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const BASE_URL = args.base || "http://localhost:5000";
const SPORT = args.sport || "tennis";
const STATE = args.state || "Chandigarh";
const RUNS = parseInt(args.runs || "5", 10);
const OUT_PATH = args.out || "./pathway-perf-report.json";

const toSlug = (s) => s.trim().toLowerCase().replace(/\s+/g, "-");
const cacheKey = `${toSlug(SPORT)}_${toSlug(STATE)}`;

const REQUIRED_LEVEL_KEYS = [
  "level", "label", "title", "description", "keyFocus", "ageRange",
  "competitions", "steps", "governingBody", "localResources", "benchmarks",
  "trialInfo", "injuryRisks", "talentSignals", "mentalSkillsFocus",
  "coachSelectionGuide", "governmentSchemes", "academicIntegration",
  "proactiveDocuments",
];

const FALLBACK_MARKER = "Information currently unavailable.";

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function validatePathway(data) {
  const issues = [];
  if (!data) {
    issues.push("No data returned.");
    return { valid: false, issues, fallbackLevels: [] };
  }
  if (!Array.isArray(data.levels) || data.levels.length !== 5) {
    issues.push(`Expected 5 levels, got ${data.levels?.length ?? "none"}.`);
  }
  const fallbackLevels = [];
  (data.levels || []).forEach((lvl, i) => {
    const missing = REQUIRED_LEVEL_KEYS.filter((k) => !(k in (lvl || {})));
    if (missing.length) {
      issues.push(`Level ${i + 1} missing keys: ${missing.join(", ")}`);
    }
    if (lvl?.description === FALLBACK_MARKER) {
      fallbackLevels.push(i + 1); // this level hit the hard-coded fallback (all model attempts failed)
    }
    if (i === 0 && lvl?.label !== "Beginner") {
      issues.push(`Level 1 label should be "Beginner", got "${lvl?.label}"`);
    }
  });
  if (!data.governingBodyNational) {
    issues.push("Missing governingBodyNational (meta call field).");
  }
  return { valid: issues.length === 0, issues, fallbackLevels };
}

// Node's built-in fetch (undici) has an undocumented ~300s default socket
// timeout that throws a generic "fetch failed" — indistinguishable from a
// real network error, and it does NOT mean the server stopped working. Set
// an explicit, honest timeout instead so a slow-but-alive request is reported
// as exactly that, not confused with a dead connection.
const CLIENT_TIMEOUT_MS = parseInt(args.timeout || "180000", 10); // 3 min default

async function forceRefresh(run) {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  let res, body;
  try {
    res = await fetch(`${BASE_URL}/api/pathways/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cacheKey }),
      signal: controller.signal,
    });
    body = await res.json();
  } catch (err) {
    const timedOut = err.name === "AbortError";
    return {
      run,
      ok: false,
      status: timedOut ? "client_timeout" : "network_error",
      latencyMs: performance.now() - start,
      error: timedOut
        ? `No response within ${CLIENT_TIMEOUT_MS}ms — server may still be generating in the background (check for a stuck contentRefreshInProgress lock).`
        : err.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
  const latencyMs = performance.now() - start;

  if (!res.ok || !body.success) {
    // Distinguish "another refresh already owns this cacheKey" from a real failure —
    // this specific message means the in-progress lock is held (possibly stuck).
    const isLockConflict = /already in-progress/i.test(body?.message || "");
    return {
      run,
      ok: false,
      status: isLockConflict ? "lock_conflict" : res.status,
      latencyMs,
      error: body?.message || `HTTP ${res.status}`,
    };
  }

  const { valid, issues, fallbackLevels } = validatePathway(body.data);
  return {
    run,
    ok: true,
    status: res.status,
    latencyMs,
    structurallyValid: valid,
    issues,
    fallbackLevels, // non-empty means some level exhausted retries and hit the safety-net default
  };
}

async function main() {
  console.log(`\n🎾 Pathway perf test — target: ${cacheKey}`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Forcing ${RUNS} full regenerations via POST /api/pathways/refresh\n`);

  // Baseline: one cold GET to confirm the sport/state combo resolves at all
  // (also warms up the connection so run 1's latency isn't skewed by TCP/TLS setup)
  try {
    const warm = await fetch(
      `${BASE_URL}/api/pathways?sport=${encodeURIComponent(SPORT)}&state=${encodeURIComponent(STATE)}`,
    );
    if (!warm.ok) {
      console.warn(`⚠️  Warm-up GET returned ${warm.status} — continuing anyway.`);
    }
  } catch (err) {
    console.error(`❌ Could not reach ${BASE_URL} at all: ${err.message}`);
    process.exit(1);
  }

  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`Run ${i}/${RUNS}... `);
    const r = await forceRefresh(i);
    results.push(r);
    if (r.ok) {
      const flagFallback = r.fallbackLevels.length
        ? ` ⚠️ fallback on level(s) ${r.fallbackLevels.join(",")}`
        : "";
      const flagInvalid = !r.structurallyValid ? " ⚠️ structural issues" : "";
      console.log(`${r.latencyMs.toFixed(0)}ms${flagFallback}${flagInvalid}`);
    } else if (r.status === "lock_conflict") {
      console.log(`SKIPPED — cacheKey lock already held (possibly stuck from a previous crashed run)`);
    } else if (r.status === "client_timeout") {
      console.log(`CLIENT TIMEOUT after ${CLIENT_TIMEOUT_MS}ms — server may still be working in the background`);
    } else {
      console.log(`FAILED (${r.status}) — ${r.error}`);
    }
  }

  const okRuns = results.filter((r) => r.ok);
  const lockConflictRuns = results.filter((r) => r.status === "lock_conflict");
  const clientTimeoutRuns = results.filter((r) => r.status === "client_timeout");
  const latencies = okRuns.map((r) => r.latencyMs).sort((a, b) => a - b);

  const summary = {
    cacheKey,
    baseUrl: BASE_URL,
    totalRuns: RUNS,
    successfulRuns: okRuns.length,
    failedRuns: RUNS - okRuns.length,
    lockConflictRuns: lockConflictRuns.length, // hit the "already in-progress" guard — check for a stuck lock
    clientTimeoutRuns: clientTimeoutRuns.length, // no response within CLIENT_TIMEOUT_MS; server may still be running
    structurallyValidRuns: okRuns.filter((r) => r.structurallyValid).length,
    runsWithFallbackLevels: okRuns.filter((r) => r.fallbackLevels.length > 0).length,
    latencyMs: latencies.length
      ? {
          min: latencies[0],
          max: latencies[latencies.length - 1],
          avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
          median: percentile(latencies, 50),
          p95: percentile(latencies, 95),
        }
      : null,
  };

  console.log("\n📊 Summary");
  console.table({
    "Success rate": `${summary.successfulRuns}/${summary.totalRuns}`,
    "Lock conflicts": summary.lockConflictRuns,
    "Client timeouts": summary.clientTimeoutRuns,
    "Structurally valid": `${summary.structurallyValidRuns}/${summary.successfulRuns || 0}`,
    "Runs w/ fallback level(s)": summary.runsWithFallbackLevels,
    "Min (ms)": summary.latencyMs?.min.toFixed(0) ?? "n/a",
    "Median (ms)": summary.latencyMs?.median.toFixed(0) ?? "n/a",
    "Avg (ms)": summary.latencyMs?.avg.toFixed(0) ?? "n/a",
    "P95 (ms)": summary.latencyMs?.p95.toFixed(0) ?? "n/a",
    "Max (ms)": summary.latencyMs?.max.toFixed(0) ?? "n/a",
  });

  if (summary.runsWithFallbackLevels > 0) {
    console.log(
      "\n⚠️  Some runs fell back to the hard-coded per-level default — that level exhausted all model attempts (2x per model, 3 models). Check server logs for which model/level combo is failing.",
    );
  }
  if (summary.lockConflictRuns > 0) {
    console.log(
      `\n🔒 ${summary.lockConflictRuns} run(s) hit an existing "in-progress" lock on ${cacheKey}. If this persists across separate test invocations (not just back-to-back runs in one script execution), the lock is likely stuck from a crashed/interrupted previous generation — clear it manually:\n   db.sportpathways.updateOne({ cacheKey: "${cacheKey}" }, { $set: { contentRefreshInProgress: false, financialRefreshInProgress: false } })`,
    );
  }
  if (summary.clientTimeoutRuns > 0) {
    console.log(
      `\n⏱️  ${summary.clientTimeoutRuns} run(s) didn't respond within ${CLIENT_TIMEOUT_MS}ms. This does NOT necessarily mean generation failed server-side — check server logs for that timestamp before assuming it's dead. Increase --timeout if your server is legitimately just slow right now.`,
    );
  }

  const fs = await import("node:fs/promises");
  await fs.writeFile(
    OUT_PATH,
    JSON.stringify({ summary, runs: results }, null, 2),
  );
  console.log(`\n💾 Full report written to ${OUT_PATH}`);

  if (summary.failedRuns > 0) process.exitCode = 1;
}

main();
