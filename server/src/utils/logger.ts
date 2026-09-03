import { writeSync } from "fs";
import { getShortRequestId } from "./requestContext";

/**
 * The terminal writer.
 *
 * Everything goes to **stdout**, including errors. Splitting across stdout and
 * stderr means the terminal interleaves the two streams unpredictably and a
 * stack trace can land three lines away from the request that caused it —
 * which defeats the whole point of making the log readable.
 */

export const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

export type LogLevel = keyof typeof LEVELS;

const isDev = process.env.NODE_ENV === "development";

const resolveLevel = (): number => {
  const raw = (process.env.LOG_LEVEL || "").trim().toLowerCase();
  if (raw in LEVELS) return LEVELS[raw as LogLevel];
  return isDev ? LEVELS.debug : LEVELS.info;
};

const activeLevel = resolveLevel();

export const isLevelEnabled = (level: LogLevel): boolean => LEVELS[level] >= activeLevel;

/* ------------------------------------------------------------------ colour */

const colourEnabled = (() => {
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR === "0") return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
})();

const code = (open: number, close: number) => (text: string) =>
  colourEnabled ? `\u001b[${open}m${text}\u001b[${close}m` : text;

export const colours = {
  reset: (t: string) => t,
  bold: code(1, 22),
  dim: code(2, 22),
  red: code(31, 39),
  green: code(32, 39),
  yellow: code(33, 39),
  blue: code(34, 39),
  magenta: code(35, 39),
  cyan: code(36, 39),
  grey: code(90, 39),
};

export const isColourEnabled = (): boolean => colourEnabled;

/** Visible width, ignoring ANSI escapes — needed to pad colourized columns. */
export const visibleLength = (text: string): number =>
  // eslint-disable-next-line no-control-regex
  text.replace(/\u001b\[[0-9;]*m/g, "").length;

/** Pad/truncate to an exact visible width, colour-safe. */
export const padVisible = (
  text: string,
  width: number,
  align: "left" | "right" = "left"
): string => {
  const len = visibleLength(text);
  if (len >= width) return text;
  const pad = " ".repeat(width - len);
  return align === "left" ? text + pad : pad + text;
};

/* ------------------------------------------------------- namespace filtering */

const namespaceRules = (process.env.LOG_NAMESPACES || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const includes = namespaceRules.filter((rule) => !rule.startsWith("-"));
const excludes = namespaceRules.filter((rule) => rule.startsWith("-")).map((rule) => rule.slice(1));

const matches = (rule: string, namespace: string): boolean =>
  rule === "*" ||
  rule === namespace ||
  (rule.endsWith("*") && namespace.startsWith(rule.slice(0, -1)));

/**
 * Applies **only** to namespaced loggers. The root logger — request lines and
 * the digest — always prints, otherwise `LOG_NAMESPACES=booking` would silence
 * the very monitoring view this work exists to provide.
 */
const namespaceEnabled = (namespace: string | undefined): boolean => {
  if (!namespace) return true;
  if (excludes.some((rule) => matches(rule, namespace))) return false;
  if (includes.length === 0) return true;
  return includes.some((rule) => matches(rule, namespace));
};

/* ------------------------------------------------------------------- dedupe */

const DEDUPE_FLUSH_MS = 250;

let pendingKey: string | null = null;
let pendingCount = 0;
let pendingTimer: NodeJS.Timeout | null = null;

/**
 * `process.on("exit")` handlers must be fully synchronous, and
 * `process.stdout.write` is *not* synchronous when stdout is a pipe rather than
 * a TTY — which is exactly the case under `npm start`, PM2, Docker or a CI
 * runner. A write queued from the exit handler would simply never flush, so the
 * final `repeated xN` line would vanish precisely where logs matter most.
 * `writeSync` to fd 1 always lands.
 */
let exiting = false;

const write = (line: string): void => {
  if (exiting) {
    try {
      writeSync(1, line + "\n");
    } catch {
      /* stdout already gone — nothing useful left to do */
    }
    return;
  }
  process.stdout.write(line + "\n");
};

const flushDedupe = (): void => {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (pendingCount > 0) {
    write(colours.grey(`   ↑ repeated x${pendingCount + 1}`));
  }
  pendingKey = null;
  pendingCount = 0;
};

// A collapsed run must not be swallowed by a process that exits mid-debounce.
process.on("exit", () => {
  exiting = true;
  flushDedupe();
});

/**
 * Write a pre-formatted line. When `dedupeKey` repeats consecutively the line
 * is suppressed and counted instead; the count is flushed as an indented
 * `repeated xN` once the run ends or the debounce elapses.
 */
export const logRaw = (line: string, dedupeKey?: string): void => {
  if (dedupeKey === undefined) {
    flushDedupe();
    write(line);
    return;
  }

  if (dedupeKey === pendingKey) {
    pendingCount += 1;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(flushDedupe, DEDUPE_FLUSH_MS);
    pendingTimer.unref?.();
    return;
  }

  flushDedupe();
  write(line);
  pendingKey = dedupeKey;
  pendingCount = 0;
  pendingTimer = setTimeout(flushDedupe, DEDUPE_FLUSH_MS);
  pendingTimer.unref?.();
};

/* ------------------------------------------------------------------ format */

const jsonFormat =
  process.env.LOG_FORMAT === "json" || (!isDev && process.env.LOG_FORMAT !== "text");

/**
 * True when output is one JSON object per line. That is the shape CloudWatch
 * Logs (and every other shipper) can parse without a custom pattern, so
 * `fields @timestamp, msg, durationMs | filter status >= 500` just works.
 */
export const isJsonFormat = (): boolean => jsonFormat;

/**
 * Fields stamped onto every structured line so lines from different tasks and
 * deployments stay separable once they are all in one log group.
 */
export const baseFields = (): Record<string, string> => ({
  service: process.env.LOG_SERVICE || "powermysport-server",
  env: process.env.NODE_ENV || "development",
  ...(process.env.LOG_VERSION ? { version: process.env.LOG_VERSION } : {}),
});

const LEVEL_COLOUR: Record<LogLevel, (t: string) => string> = {
  trace: colours.grey,
  debug: colours.grey,
  info: colours.blue,
  warn: colours.yellow,
  error: colours.red,
  fatal: colours.magenta,
};

export const formatClock = (date = new Date()): string =>
  [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");

const formatFields = (fields: Record<string, unknown>): string =>
  Object.entries(fields)
    .map(([key, value]) => {
      const rendered =
        typeof value === "string"
          ? value
          : value instanceof Error
            ? value.message
            : (() => {
                try {
                  return JSON.stringify(value);
                } catch {
                  return String(value);
                }
              })();
      return `${colours.grey(key + "=")}${rendered}`;
    })
    .join(" ");

/**
 * A bag of named values, as opposed to a positional console-style extra.
 * Errors and arrays are deliberately excluded — an Error carries a stack we
 * want rendered, not JSON-stringified into an unreadable blob.
 */
const isFieldBag = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value) || value instanceof Error || value instanceof Date) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const renderExtra = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * Accept both the structured call — `log.info("Slot locked", { bookingId })` —
 * and the console-style one — `log.error("Refund failed:", err)`.
 *
 * Supporting the second form is what made migrating 400-odd `console.*` call
 * sites a mechanical rename instead of 400 hand-rewrites, each an opportunity
 * to change behaviour by accident.
 */
const normalizeArgs = (rest: unknown[]): { fields: Record<string, unknown>; suffix: string } => {
  if (rest.length === 0) return { fields: {}, suffix: "" };
  if (rest.length === 1 && isFieldBag(rest[0])) {
    return { fields: rest[0], suffix: "" };
  }

  const fields: Record<string, unknown> = {};
  const parts: string[] = [];
  for (const value of rest) {
    // An Error anywhere in the args is the most useful thing in the line —
    // promote it to a field so the stack survives into JSON output.
    if (value instanceof Error) {
      if (fields.err === undefined) {
        fields.err = value.message;
        if (value.stack) fields.stack = value.stack;
        continue;
      }
    }
    parts.push(renderExtra(value));
  }
  return { fields, suffix: parts.length ? ` ${parts.join(" ")}` : "" };
};

const emit = (
  level: LogLevel,
  namespace: string | undefined,
  message: string,
  rest: unknown[]
): void => {
  if (!isLevelEnabled(level)) return;
  if (!namespaceEnabled(namespace)) return;

  const { fields, suffix } = normalizeArgs(rest);
  if (suffix) message = `${message}${suffix}`;

  const requestId = getShortRequestId();
  const merged: Record<string, unknown> = { ...fields };
  if (requestId && merged.req === undefined) merged.req = requestId;

  if (jsonFormat) {
    logRaw(
      JSON.stringify({
        ...baseFields(),
        time: new Date().toISOString(),
        level,
        ...(namespace ? { ns: namespace } : {}),
        msg: message,
        ...merged,
      })
    );
    return;
  }

  // A stack belongs under the line, not inside it — inlined as a field it is
  // one 800-character row that destroys the alignment of everything around it.
  const { stack, ...inline } = merged as { stack?: unknown };

  const parts = [
    colours.grey(formatClock()),
    LEVEL_COLOUR[level](padVisible(level.toUpperCase(), 5)),
    namespace ? colours.cyan(padVisible(namespace, 10)) : padVisible("", 10),
    message,
  ];
  const rendered = Object.keys(inline).length
    ? `${parts.join(" ")}  ${formatFields(inline)}`
    : parts.join(" ");

  logRaw(rendered);

  if (typeof stack === "string") {
    for (const stackLine of stack.split("\n").slice(1)) {
      logRaw(colours.grey(`      ${stackLine.trim()}`));
    }
  }
};

/* --------------------------------------------------------------------- API */

export interface Logger {
  trace(message: string, ...rest: unknown[]): void;
  debug(message: string, ...rest: unknown[]): void;
  info(message: string, ...rest: unknown[]): void;
  warn(message: string, ...rest: unknown[]): void;
  error(message: string, ...rest: unknown[]): void;
  fatal(message: string, ...rest: unknown[]): void;
  child(namespace: string): Logger;
}

const makeLogger = (namespace?: string): Logger => ({
  trace: (message, ...rest) => emit("trace", namespace, message, rest),
  debug: (message, ...rest) => emit("debug", namespace, message, rest),
  info: (message, ...rest) => emit("info", namespace, message, rest),
  warn: (message, ...rest) => emit("warn", namespace, message, rest),
  error: (message, ...rest) => emit("error", namespace, message, rest),
  fatal: (message, ...rest) => emit("fatal", namespace, message, rest),
  child: (child) => makeLogger(namespace ? `${namespace}:${child}` : child),
});

export const log = makeLogger();
export default log;
