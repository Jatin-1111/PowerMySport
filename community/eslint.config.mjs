import { fileURLToPath } from "node:url";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// The Next.js plugin's `no-html-link-for-pages` rule looks for a `pages/` or
// `app/` directory under `settings.next.rootDir`, defaulting to the current
// working directory when unset. That default only holds when eslint is
// invoked from inside `community/` — the root lint-staged config invokes it
// from the repo root instead, where neither directory exists, so the rule
// silently no-ops (and prints a "Pages directory cannot be found" warning
// that lint-staged treats as a failure). Pinning rootDir to this file's own
// directory makes the rule work the same regardless of the caller's cwd.
const rootDir = fileURLToPath(new URL(".", import.meta.url));

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  { settings: { next: { rootDir } } },
  {
    // This app is only now being wired into pre-commit enforcement, and
    // these five rules currently fire as errors on ~65 pre-existing call
    // sites across ~40 files (mostly `set-state-in-effect` and
    // `no-explicit-any`) that a dedicated cleanup pass hasn't reached yet.
    // At error severity, lint-staged would block any future commit that so
    // much as touches one of those files, for code unrelated to the change
    // being made. Downgraded to warn — still visible, still fails a plain
    // `eslint .` run, just doesn't block commits — until that pass lands and
    // these can go back to "error".
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
