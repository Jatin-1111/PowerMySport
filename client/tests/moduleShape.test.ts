import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

/**
 * Pins the shape of `src/modules/*`.
 *
 * The vocabulary below was not invented — it is what the codebase already used
 * most of the time (services in 16 modules, components in 13, utils in 6). What
 * it did not have was consistency: `rankings` kept ten components and its API
 * client loose at the module root, `pathway` had nine loose files, one module
 * called its store `lib/` and another called its static data `constants/`.
 *
 * That inconsistency is what makes per-module ownership unassignable — you
 * cannot say "this team owns pathway's services" when a module's services might
 * be a root-level file, might be under services/, and might be filed under a
 * different module entirely. The eslint boundary rules can only police the edges
 * *between* modules; this policies the shape *within* one.
 */

const MODULES_DIR = path.resolve(__dirname, "../src/modules");

/** The only directory names a module may contain. */
const CANONICAL = [
  "components", // React components for this feature
  "config", // tunables and lookup tables
  "data", // static content
  "hooks", // React hooks
  "services", // API access
  "store", // client state
  "types", // shared types (2+ files; a lone types.ts may sit at the root)
  "ui", // presentational primitives — src/modules/shared only
  "utils", // pure helpers
] as const;

const modules = fs
  .readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const entries = (dir: string) => fs.readdirSync(dir, { withFileTypes: true });

it("finds the modules to check", () => {
  // Guards against the whole suite passing vacuously if src/modules moves.
  expect(modules.length).toBeGreaterThan(15);
});

describe.each(modules)("src/modules/%s", (name) => {
  const dir = path.join(MODULES_DIR, name);

  it("uses only canonical directory names", () => {
    const dirs = entries(dir)
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(dirs.filter((d) => !CANONICAL.includes(d as never))).toEqual([]);
  });

  it("keeps components out of the module root", () => {
    // A component at the module root is the first step to a module with thirty
    // loose files and no discoverable structure.
    const loose = entries(dir)
      .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
      .map((e) => e.name);
    expect(loose).toEqual([]);
  });

  it("keeps at most three loose files at the module root", () => {
    // A lone types.ts or utils.ts reads better than a directory holding one
    // file, so root files are allowed — but past a handful they are the problem
    // this test exists for, and the concern has earned a directory.
    const loose = entries(dir)
      .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
      .map((e) => e.name);
    expect(loose.length).toBeLessThanOrEqual(3);
  });
});

it("keeps ui/ primitives in one place", () => {
  // Two primitives directories is how a second, near-duplicate Button and Card
  // got written: there was no single answer to "where does Button live".
  const withUi = modules.filter((m) =>
    fs.existsSync(path.join(MODULES_DIR, m, "ui")),
  );
  expect(withUi).toEqual(["shared"]);
});
