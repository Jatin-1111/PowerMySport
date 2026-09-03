import { monitorEventLoopDelay, type IntervalHistogram } from "perf_hooks";
import { takeWindowSnapshot } from "../middleware/observability";
import { baseFields, colours, isJsonFormat, logRaw, padVisible } from "./logger";

/**
 * A periodic aggregate so trends are visible without reading every line.
 *
 * The rule that matters: **a window with zero requests prints nothing.** An
 * idle terminal must stay completely silent, otherwise this becomes exactly
 * the noise the overhaul set out to remove.
 */

const DEFAULT_INTERVAL_MS = 60_000;

let histogram: IntervalHistogram | null = null;
let timer: NodeJS.Timeout | null = null;

const formatMs = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

const resolveIntervalMs = (): number | null => {
  if (process.env.LOG_DIGEST === "off") return null;

  const explicit = Number(process.env.LOG_DIGEST_MS);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  // Production is opt-in only — enabling it there is Phase 3's call, not this
  // middleware's.
  return process.env.NODE_ENV === "development" ? DEFAULT_INTERVAL_MS : null;
};

const printDigest = (windowMs: number): void => {
  const snapshot = takeWindowSnapshot();

  const lagMean = histogram ? histogram.mean / 1e6 : 0;
  const lagP99 = histogram ? histogram.percentile(99) / 1e6 : 0;
  histogram?.reset();

  if (snapshot.count === 0) return;

  const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  const errorRate = (snapshot.errorRate * 100).toFixed(1);

  const errorPart =
    snapshot.errors > 0
      ? colours.red(`${snapshot.errors} err (${errorRate}%)`)
      : colours.grey(`0 err`);

  if (isJsonFormat()) {
    logRaw(
      JSON.stringify({
        ...baseFields(),
        time: new Date().toISOString(),
        level: "info",
        msg: "digest",
        windowMs,
        count: snapshot.count,
        errors: snapshot.errors,
        errorRate: Number(snapshot.errorRate.toFixed(4)),
        p50: Math.round(snapshot.p50),
        p95: Math.round(snapshot.p95),
        p99: Math.round(snapshot.p99),
        dbShare: Number(snapshot.dbShare.toFixed(3)),
        extShare: Number(snapshot.extShare.toFixed(3)),
        loopLagMeanMs: Number(lagMean.toFixed(2)),
        loopLagP99Ms: Number(lagP99.toFixed(2)),
        heapMb,
        routes: snapshot.routes.slice(0, 5).map((route) => ({
          routeKey: route.routeKey,
          count: route.count,
          p95: Math.round(route.p95),
          budgetMs: route.budgetMs,
          overBudget: route.overBudget,
        })),
      })
    );
    return;
  }

  logRaw(
    colours.grey(`-- last ${Math.round(windowMs / 1000)}s -- `) +
      [
        `${snapshot.count} req`,
        errorPart,
        `p50 ${formatMs(snapshot.p50)}`,
        `p95 ${formatMs(snapshot.p95)}`,
        `p99 ${formatMs(snapshot.p99)}`,
        `db ${Math.round(snapshot.dbShare * 100)}% ext ${Math.round(snapshot.extShare * 100)}%`,
        `loop lag ${formatMs(lagMean)} (p99 ${formatMs(lagP99)})`,
        `heap ${heapMb}MB`,
      ].join(colours.grey(" | "))
  );

  for (const route of snapshot.routes.slice(0, 3)) {
    const [method = "", ...rest] = route.routeKey.split(" ");
    logRaw(
      colours.grey("   ") +
        padVisible(method, 5) +
        padVisible(rest.join(" "), 32) +
        padVisible(`${route.count} req`, 10, "right") +
        `  ${colours.grey("p95")} ${formatMs(route.p95)}`
    );
  }

  // Budget breaches print last and loud — a regression is the one thing in the
  // digest that is meant to make you stop scrolling.
  for (const breach of snapshot.breaches.slice(0, 5)) {
    logRaw(
      colours.yellow("   ! over budget  ") +
        padVisible(breach.routeKey, 40) +
        `p95 ${colours.yellow(formatMs(breach.p95))} ${colours.grey("vs budget")} ${formatMs(
          breach.budgetMs ?? 0
        )}`
    );
  }
};

/** Starts the digest interval. No-op (returns a no-op stopper) when disabled. */
export const startLogDigest = (): (() => void) => {
  const intervalMs = resolveIntervalMs();
  if (intervalMs === null) return () => {};
  if (timer) return stopLogDigest;

  histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  timer = setInterval(() => printDigest(intervalMs), intervalMs);
  // Never hold the process open during shutdown.
  timer.unref();

  return stopLogDigest;
};

export const stopLogDigest = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (histogram) {
    histogram.disable();
    histogram = null;
  }
};
