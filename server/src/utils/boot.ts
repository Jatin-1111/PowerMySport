import { baseFields, colours, isJsonFormat, logRaw } from "./logger";

/**
 * Boot output.
 *
 * Startup used to print ~60 lines: five copies of the S3 config, four mongoose
 * duplicate-index warnings, a dotenv tip banner, and a running commentary of
 * every scheduler announcing itself twice ("Initializing X..." then "X
 * initialized"). None of it was readable and none of it was actionable.
 *
 * The rule here: **a subsystem that started normally gets a fragment, not a
 * line.** Facts are collected as the app wires itself up and printed once, as
 * one aligned block, when the server is listening. Anything that did *not* go
 * normally is a warning, and warnings print on their own line where they stand
 * out against an otherwise quiet block.
 */

const startedAt = process.hrtime.bigint();

/** Fixed display order; anything unrecognised is appended in arrival order. */
const SECTION_ORDER = ["http", "mongo", "redis", "s3", "ai", "sockets", "jobs"];

const facts = new Map<string, string[]>();
const warnings: string[] = [];

/**
 * Record a boot fact. Repeated calls for the same section append, so five
 * S3Service constructions collapse into one entry rather than five blocks.
 */
export const bootFact = (section: string, detail: string): void => {
  const existing = facts.get(section);
  if (!existing) {
    facts.set(section, [detail]);
    return;
  }
  if (!existing.includes(detail)) existing.push(detail);
};

/** Record a boot fact only once, ignoring later duplicates outright. */
export const bootFactOnce = (section: string, detail: string): void => {
  if (facts.has(section)) return;
  facts.set(section, [detail]);
};

export const bootWarn = (message: string): void => {
  warnings.push(message);
};

const orderedSections = (): string[] => {
  const known = SECTION_ORDER.filter((section) => facts.has(section));
  const extra = Array.from(facts.keys()).filter((section) => !SECTION_ORDER.includes(section));
  return [...known, ...extra];
};

/**
 * Print the boot block. Call once, when the server is actually listening —
 * printing earlier means printing facts that may still be wrong.
 */
export const bootReady = (): void => {
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const sections = orderedSections();

  if (isJsonFormat()) {
    logRaw(
      JSON.stringify({
        ...baseFields(),
        time: new Date().toISOString(),
        level: "info",
        msg: "boot",
        bootMs: Math.round(elapsedMs),
        node: process.version,
        pid: process.pid,
        ...Object.fromEntries(sections.map((section) => [section, facts.get(section)!.join(" ")])),
        ...(warnings.length ? { warnings } : {}),
      })
    );
    facts.clear();
    warnings.length = 0;
    return;
  }

  const width = sections.reduce((max, s) => Math.max(max, s.length), 0);

  logRaw("");
  logRaw(
    `  ${colours.bold("PowerMySport")}  ${colours.grey(
      `${process.env.NODE_ENV || "development"} · node ${process.version} · pid ${process.pid}`
    )}`
  );
  logRaw("");

  for (const section of sections) {
    logRaw(
      `  ${colours.cyan(section.padEnd(width))}  ${facts.get(section)!.join(colours.grey(" · "))}`
    );
  }

  for (const warning of warnings) {
    logRaw(`  ${colours.yellow("!")} ${colours.yellow(warning)}`);
  }

  logRaw("");
  logRaw(`  ${colours.green("ready")} ${colours.grey(`in ${(elapsedMs / 1000).toFixed(1)}s`)}`);
  logRaw("");

  // Boot facts are a startup-only concern; holding them wastes nothing but
  // invites a second, stale print if anything ever calls this twice.
  facts.clear();
  warnings.length = 0;
};
