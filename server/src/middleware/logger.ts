import { NextFunction, Request, Response } from "express";
import {
  colours,
  isJsonFormat,
  logRaw,
  padVisible,
  isLevelEnabled,
  formatClock,
  baseFields,
} from "../utils/logger";
import { getRequestContext } from "../utils/requestContext";

/**
 * One aligned line per request, emitted from the response `finish` event.
 *
 * `finish` — not a patched `res.json` — is what makes 404s, redirects,
 * `res.send`, `res.end` and streamed responses visible. The old monkey-patch
 * only ever saw JSON replies, which is precisely why the failures you most
 * wanted to see never appeared.
 */

const SLOW_MS = Number(process.env.LOG_SLOW_MS || 400);
const VERY_SLOW_MS = 1000;

const DEFAULT_SKIP = [
  "/health",
  "/socket.io",
  "/favicon.ico",
  // The admin Server tab polls this continuously.
  "/api/stats/infra",
];

const skipPrefixes = (() => {
  const raw = process.env.LOG_SKIP;
  if (raw === "none") return [];
  if (!raw) return DEFAULT_SKIP;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
})();

const isSkipped = (path: string): boolean =>
  skipPrefixes.some((prefix) => path.startsWith(prefix));

const clockWithMs = (date = new Date()): string =>
  `${formatClock(date)}.${String(date.getMilliseconds()).padStart(3, "0")}`;

const colourStatus = (status: number): string => {
  const text = String(status);
  if (status >= 500) return colours.red(text);
  if (status >= 400) return colours.yellow(text);
  if (status >= 300) return colours.cyan(text);
  if (status >= 200) return colours.green(text);
  return colours.grey(text);
};

const formatDuration = (ms: number): { text: string; flag: string } => {
  const rendered =
    ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

  if (ms >= VERY_SLOW_MS) {
    return {
      text: colours.red(colours.bold(rendered)),
      flag: colours.red("SLOW"),
    };
  }
  if (ms >= SLOW_MS) {
    return { text: colours.yellow(rendered), flag: colours.yellow("slow") };
  }
  if (ms < 100) {
    return { text: colours.dim(colours.green(rendered)), flag: "" };
  }
  return { text: rendered, flag: "" };
};

const METHOD_COLOUR: Record<string, (t: string) => string> = {
  GET: colours.green,
  POST: colours.blue,
  PUT: colours.yellow,
  PATCH: colours.yellow,
  DELETE: colours.red,
};

const PATH_WIDTH = 44;

const formatTarget = (req: Request): string => {
  const target = req.originalUrl || req.url || req.path;
  if (target.length <= PATH_WIDTH) return target;
  return `${target.slice(0, PATH_WIDTH - 1)}…`;
};

/**
 * Dev shows the email local-part because it is the fastest way to recognise
 * yourself in a local terminal. Production never does: an email local-part is
 * still personal data once it is shipped to a log store, so the opaque user id
 * is used instead — it correlates just as well and identifies no one on sight.
 */
const describeUser = (req: Request): string | null => {
  const user = (req as any).user;
  if (!user) return null;

  if (process.env.NODE_ENV === "production") {
    const id = user._id ?? user.id;
    return id ? String(id) : null;
  }

  const email = user.email as string | undefined;
  if (!email) return null;
  return email.split("@")[0] ?? email;
};

const redactBody = (body: unknown): unknown => {
  if (!body || typeof body !== "object") return body;
  const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    if (/password|token|secret|otp/i.test(key)) copy[key] = "***HIDDEN***";
  }
  return copy;
};

const round = (ms: number): number => Math.round(ms * 10) / 10;

/* ------------------------------------------------- production behaviour */

const IS_PROD = process.env.NODE_ENV === "production";

/** `LOG_REQUESTS=off` kills the request stream entirely, in any environment. */
const REQUESTS_ENABLED = process.env.LOG_REQUESTS !== "off";

/**
 * Fraction of *ordinary* requests that get a line. Errors and slow requests
 * bypass this entirely — sampling away the failures would defeat the purpose
 * of logging at all. Default: everything in dev, 10% in production.
 */
const SAMPLE_RATE = (() => {
  const raw = Number(process.env.LOG_SAMPLE_RATE);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 1) return raw;
  return IS_PROD ? 0.1 : 1;
})();

/**
 * Query strings routinely carry emails, tokens and invite codes. In production
 * the keys are kept (they are what you need to reproduce a route) and every
 * value is dropped. Dev keeps the full URL — it is a local terminal.
 */
const queryKeysOf = (req: Request): string[] => Object.keys(req.query || {});

/**
 * Body/query/param dumping is a development affordance only. Honouring
 * VERBOSE_HTTP_LOGS in production would print request bodies — passwords,
 * payment payloads, personal details — into a shipped log stream.
 */
const verboseAllowed = !IS_PROD;

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!REQUESTS_ENABLED) {
    return next();
  }

  const fallbackStart = process.hrtime.bigint();
  const verbose = verboseAllowed && process.env.VERBOSE_HTTP_LOGS === "true";
  // Captured here rather than inside `finish`: that event fires in the
  // socket's async context, where the request's ALS store is unreachable.
  const context = getRequestContext();
  const requestId = context?.requestId.slice(0, 8);

  res.on("finish", () => {
    const startedAt = context?.startedAt ?? fallbackStart;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const status = res.statusCode;

    // Skipped paths still recorded metrics upstream; they only stay quiet while
    // they are healthy and fast. A failing or slow health check is news.
    if (isSkipped(req.path) && status < 400 && durationMs < SLOW_MS) {
      return;
    }

    // `warn` and above silences the ordinary request stream.
    if (!isLevelEnabled("info") && status < 400) return;

    const noteworthy = status >= 400 || durationMs >= SLOW_MS;

    // Sample ordinary traffic only. Anything that failed or dragged is always
    // kept — those are the lines someone will actually go looking for.
    if (!noteworthy && SAMPLE_RATE < 1 && Math.random() >= SAMPLE_RATE) {
      return;
    }

    const method = req.method.toUpperCase();
    const spans = context?.spans;
    // Handler time is the residue — never measured, only inferred.
    const handlerMs = spans
      ? Math.max(0, durationMs - spans.dbMs - spans.extMs)
      : durationMs;
    const user = describeUser(req);

    if (isJsonFormat()) {
      logRaw(
        JSON.stringify({
          ...baseFields(),
          time: new Date().toISOString(),
          level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
          msg: "request",
          method,
          // Production logs the pathname and the query *keys* only — query
          // values carry emails, tokens and invite codes.
          path: IS_PROD ? req.path : req.originalUrl || req.url,
          ...(IS_PROD && queryKeysOf(req).length
            ? { queryKeys: queryKeysOf(req) }
            : {}),
          route: req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : null,
          status,
          durationMs: round(durationMs),
          dbMs: spans ? round(spans.dbMs) : 0,
          dbCalls: spans ? spans.dbCount : 0,
          extMs: spans ? round(spans.extMs) : 0,
          extCalls: spans ? spans.extCount : 0,
          handlerMs: round(handlerMs),
          slow: durationMs >= SLOW_MS,
          ...(user ? (IS_PROD ? { uid: user } : { user }) : {}),
          ...(SAMPLE_RATE < 1 && !noteworthy ? { sampled: SAMPLE_RATE } : {}),
          ...(context ? { req: context.requestId } : {}),
        }),
      );
      return;
    }

    const colourMethod = METHOD_COLOUR[method] || colours.grey;
    const { text: duration, flag } = formatDuration(durationMs);

    // Only shown when there is something to attribute — a request that touched
    // neither Mongo nor a third party should not carry two empty columns.
    const attribution: string[] = [];
    if (spans && spans.dbCount > 0) {
      attribution.push(
        colours.grey(`db ${Math.round(spans.dbMs)}ms/${spans.dbCount}`),
      );
    }
    if (spans && spans.extCount > 0) {
      attribution.push(
        colours.magenta(`ext ${Math.round(spans.extMs)}ms/${spans.extCount}`),
      );
    }

    const line = [
      colours.grey(clockWithMs()),
      colourMethod(padVisible(method, 6)),
      padVisible(formatTarget(req), PATH_WIDTH),
      padVisible(colourStatus(status), 3),
      padVisible(duration, 8, "right"),
      attribution.join(" "),
      user ? colours.grey(user) : colours.grey("—"),
      requestId ? colours.grey(`req=${requestId}`) : "",
      flag,
    ]
      .filter(Boolean)
      .join("  ");

    // Dedupe key deliberately excludes duration — otherwise identical polling
    // requests never collapse.
    logRaw(line, `${method} ${req.originalUrl} ${status}`);

    if (verbose) {
      const detail: string[] = [];
      if (Object.keys(req.query || {}).length)
        detail.push(`query ${JSON.stringify(req.query)}`);
      if (Object.keys(req.params || {}).length)
        detail.push(`params ${JSON.stringify(req.params)}`);
      if (req.body && Object.keys(req.body).length)
        detail.push(`body ${JSON.stringify(redactBody(req.body))}`);
      for (const entry of detail) {
        logRaw(colours.grey(`      ${entry}`));
      }
    }
  });

  next();
};

/**
 * Errors print as one line plus an indented stack, carrying the request id so
 * they tie back to the request line above them.
 */
export const errorLogger = (
  err: any,
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // Errors are never sampled and never silenced — an unhandled failure is the
  // single most useful line the server can emit.
  if (!REQUESTS_ENABLED) {
    return next(err);
  }

  const context = getRequestContext();
  const requestId = context?.requestId.slice(0, 8);

  if (isJsonFormat()) {
    logRaw(
      JSON.stringify({
        ...baseFields(),
        time: new Date().toISOString(),
        level: "error",
        msg: "request failed",
        method: req.method.toUpperCase(),
        path: req.originalUrl || req.url,
        err: err?.name || "Error",
        errMsg: err?.message || String(err),
        stack: err?.stack ? String(err.stack) : undefined,
        ...(context ? { req: context.requestId } : {}),
      }),
    );
    return next(err);
  }

  logRaw(
    [
      colours.grey(clockWithMs()),
      colours.red(colours.bold("ERROR")),
      `${req.method.toUpperCase()} ${req.originalUrl || req.url}`,
      colours.red(`${err?.name || "Error"}: ${err?.message || String(err)}`),
      requestId ? colours.grey(`req=${requestId}`) : "",
    ]
      .filter(Boolean)
      .join("  "),
  );

  if (err?.stack) {
    for (const stackLine of String(err.stack).split("\n").slice(1)) {
      logRaw(colours.grey(`      ${stackLine.trim()}`));
    }
  }

  next(err);
};
