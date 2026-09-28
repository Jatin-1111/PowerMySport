// ─── Comparing an extraction with the live entry, and applying what is kept ─
//
// The review screen is a list of proposed changes, one row per field, each
// with the quote that supports it; the reviewer keeps or drops each row. This
// is the pure logic behind it, kept apart from the controller so it can be
// tested without a database.
//
// Granularity is one level into the nested objects. "eligibility.level" and
// "eligibility.income" are separate rows, because a new circular often changes
// one of them and not the other, and a reviewer must be able to accept the one
// without the other. Nothing goes deeper than that, so lists (steps, key
// facts, key dates) and the amount are compared whole: half a list of steps is
// not a smaller correct list.

/** Nested objects whose keys are compared and applied one at a time. */
const NESTED = ["owner", "geography", "eligibility", "benefit", "cycle"] as const;

/** Never proposed, never applied from a source: identity, provenance and status. */
const NOT_FROM_SOURCE = new Set([
  "slug",
  "track",
  "status",
  "publishedAt",
  "sources",
  "lastVerifiedOn",
  "verificationNote",
  "sourcePublishedOn",
]);

export interface ProposedChange {
  /** "summary", "eligibility.level", "cycle.keyDates". */
  path: string;
  current: unknown;
  proposed: unknown;
  /** The quote the model gave for this path's top-level field, if any. */
  citation?: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/** Order-sensitive structural equality, which is what "changed" means here. */
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Every comparable path in a record, with its value. */
function leaves(record: Record<string, unknown>): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    if (NOT_FROM_SOURCE.has(key)) continue;
    if ((NESTED as readonly string[]).includes(key) && isPlainObject(value)) {
      for (const [inner, innerValue] of Object.entries(value)) {
        out.set(`${key}.${inner}`, innerValue);
      }
    } else {
      out.set(key, value);
    }
  }
  return out;
}

const getPath = (record: Record<string, unknown>, path: string): unknown => {
  const [head, tail] = path.split(".", 2) as [string, string | undefined];
  const value = record[head];
  return tail === undefined ? value : isPlainObject(value) ? value[tail] : undefined;
};

/**
 * What the source proposes that differs from the entry. A field the source is
 * silent on is not a proposal to clear it: absence in a document means it did
 * not say, not that the rule was withdrawn.
 */
export function proposedChanges(
  current: Record<string, unknown> | null,
  extracted: Record<string, unknown>,
  citations: Record<string, string> = {}
): ProposedChange[] {
  const base = current ?? {};
  const changes: ProposedChange[] = [];
  for (const [path, proposed] of leaves(extracted)) {
    if (isEmpty(proposed)) continue;
    const existing = getPath(base, path);
    if (same(existing, proposed)) continue;
    const top = path.split(".")[0]!;
    changes.push({
      path,
      current: existing ?? null,
      proposed,
      ...(citations[top] ? { citation: citations[top] } : {}),
    });
  }
  return changes;
}

/**
 * The entry with the kept changes written in. Everything the reviewer did not
 * keep, and everything the source did not mention, is left as it was.
 */
export function applyChanges(
  current: Record<string, unknown> | null,
  changes: ProposedChange[],
  keep: ReadonlySet<string>
): Record<string, unknown> {
  const next: Record<string, unknown> = JSON.parse(JSON.stringify(current ?? {}));
  for (const change of changes) {
    if (!keep.has(change.path)) continue;
    const [head, tail] = change.path.split(".", 2) as [string, string | undefined];
    if (tail === undefined) {
      next[head] = change.proposed;
      continue;
    }
    // One level down only, so a nested list or the amount is replaced whole.
    const parent = isPlainObject(next[head]) ? (next[head] as Record<string, unknown>) : {};
    parent[tail] = change.proposed;
    next[head] = parent;
  }
  return next;
}

/**
 * Put the approved source at the top of the entry's sources, replacing an
 * older listing of the same URL rather than listing it twice.
 */
export function withSource(
  sources: Array<{ label: string; url: string; publishedOn?: string }> | undefined,
  source: { label: string; url: string; publishedOn?: string }
): Array<{ label: string; url: string; publishedOn?: string }> {
  const rest = (sources ?? []).filter((s) => s.url !== source.url);
  return [source, ...rest].slice(0, 8);
}
