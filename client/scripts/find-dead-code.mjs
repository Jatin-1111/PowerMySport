/**
 * Dead-code detector for the features/ refactor.
 *
 * Two reports:
 *   1. Files unreachable from any entry point (Next.js route files, tests,
 *      middleware). Computed transitively, so a file whose only importer is
 *      itself dead is correctly reported as dead too.
 *   2. Exports never referenced outside their own file.
 *
 * Report 2 is a FLOOR, not an exact set: usage is matched by bare identifier, so
 * any same-named identifier elsewhere counts as a reference. It under-reports
 * dead code rather than over-reporting it, which is the safe direction. Star
 * re-exports are not resolved — review before deleting.
 *
 * Usage:
 *   node scripts/find-dead-code.mjs           # both reports
 *   node scripts/find-dead-code.mjs --files   # unimported files only
 *   node scripts/find-dead-code.mjs --exports # unused exports only
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const args = process.argv.slice(2);
const wantFiles = args.length === 0 || args.includes("--files");
const wantExports = args.length === 0 || args.includes("--exports");

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p.split(path.sep).join("/"));
  }
})(ROOT);

const contents = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

const ROUTE_ENTRY =
  /\/(page|layout|route|template|error|loading|not-found|global-error|default|sitemap|robots|opengraph-image|twitter-image|icon|apple-icon|manifest)\.(ts|tsx)$/;
const isRouteEntry = (f) => f.startsWith("src/app/") && ROUTE_ENTRY.test(f);
const isTest = (f) => /\.(test|spec)\.(ts|tsx)$/.test(f);
const isSpecial = (f) => /(middleware|instrumentation|next-env)\./.test(f);

function resolveImport(base) {
  const candidates = [
    base + ".tsx",
    base + ".ts",
    base + "/index.tsx",
    base + "/index.ts",
    base,
  ];
  return candidates.find((c) => contents.has(c)) ?? null;
}

/** Resolve an import specifier against the project's path aliases. */
function specToPath(fromFile, spec) {
  if (spec.startsWith("@/")) return "src/" + spec.slice(2);
  if (spec.startsWith("@modules/")) return "src/modules/" + spec.slice(9);
  if (spec.startsWith("@lib/")) return "src/lib/" + spec.slice(5);
  if (spec.startsWith("."))
    return path.posix.normalize(
      path.posix.join(path.posix.dirname(fromFile), spec),
    );
  return null;
}

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\(\s*)['"]([^'"]+)['"]/g;

let exitCode = 0;

if (wantFiles) {
  // Build the import graph, then walk it from the real entry points.
  //
  // Reachability matters rather than "is imported by anything": a file whose
  // only importer is itself dead is also dead, and an is-imported check would
  // report it as live. That cascade is what makes this report trustworthy
  // enough to delete from.
  const edges = new Map();
  for (const [f, code] of contents) {
    const out = new Set();
    for (const m of code.matchAll(IMPORT_RE)) {
      const base = specToPath(f, m[1]);
      if (!base) continue;
      const hit = resolveImport(base);
      if (hit) out.add(hit);
    }
    edges.set(f, out);
  }

  const entries = files.filter(
    (f) => isRouteEntry(f) || isTest(f) || isSpecial(f),
  );
  const reachable = new Set();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (reachable.has(f)) continue;
    reachable.add(f);
    for (const next of edges.get(f) ?? []) {
      if (!reachable.has(next)) stack.push(next);
    }
  }

  const orphans = files.filter((f) => !reachable.has(f)).sort();

  let lines = 0;
  console.log(`Scanned ${files.length} files under ${ROOT}/`);
  console.log(
    `${entries.length} entry points, ${reachable.size} files reachable\n`,
  );
  console.log(`=== UNREACHABLE FROM ANY ENTRY POINT (${orphans.length}) ===`);
  for (const o of orphans) {
    const n = contents.get(o).split("\n").length;
    lines += n;
    console.log(`  ${String(n).padStart(5)}  ${o}`);
  }
  console.log(`\n  total: ${lines} lines`);
  if (orphans.length) exitCode = 1;
}

if (wantExports) {
  const NEXT_RESERVED = new Set([
    "default", "metadata", "generateMetadata", "generateStaticParams",
    "revalidate", "dynamic", "dynamicParams", "fetchCache", "runtime",
    "preferredRegion", "maxDuration", "viewport", "generateViewport",
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "config",
  ]);

  const declared = new Map();
  for (const [f, code] of contents) {
    const names = new Set();
    const declRe =
      /export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
    for (const m of code.matchAll(declRe)) names.add(m[1]);
    const listRe = /export\s*\{([^}]*)\}/g;
    for (const m of code.matchAll(listRe)) {
      for (const raw of m[1].split(",")) {
        const part = raw.trim();
        if (!part) continue;
        const as = part.split(/\s+as\s+/);
        names.add((as[1] ?? as[0]).trim());
      }
    }
    if (names.size) declared.set(f, names);
  }

  const seenIn = new Map();
  for (const [f, code] of contents) {
    for (const id of new Set(code.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [])) {
      if (!seenIn.has(id)) seenIn.set(id, new Set());
      seenIn.get(id).add(f);
    }
  }

  const results = [];
  let total = 0;
  for (const [f, names] of declared) {
    const dead = [...names].filter((n) => {
      if (isRouteEntry(f) && NEXT_RESERVED.has(n)) return false;
      const refs = seenIn.get(n);
      return !refs || [...refs].every((x) => x === f);
    });
    if (dead.length) {
      results.push([f, dead]);
      total += dead.length;
    }
  }
  results.sort((a, b) => b[1].length - a[1].length);

  console.log(`\n=== EXPORTS NEVER REFERENCED OUTSIDE THEIR OWN FILE ===`);
  console.log(`${total} exports across ${results.length} files`);
  console.log(`(floor, not exact — see header comment before deleting)\n`);
  for (const [f, dead] of results) {
    console.log(`  ${f}`);
    console.log(`      ${dead.join(", ")}`);
  }
}

process.exit(exitCode);
