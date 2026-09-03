import { ESLint } from "eslint";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Asserts the module-boundary rules in eslint.config.mjs actually fire.
 *
 * This exists because of a real mistake: the rules were first written as one
 * broad block for `@/app` imports plus narrower per-layer blocks. Flat config
 * resolves a rule by *last matching block wins* rather than by merging, so the
 * narrower blocks silently erased the `@/app` ban for src/modules and src/lib.
 * `eslint .` reported zero violations either way — a disarmed rule and an obeyed
 * rule look identical from the outside.
 *
 * So each case below lints a synthetic file at a real path and checks the
 * verdict directly. A glob typo, a shadowed block, or a deleted layer turns into
 * a failing test instead of a quiet loss of enforcement.
 */

const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") });

// Loading the flat config and typescript-eslint takes several seconds cold. Warm
// it once here rather than charging it to whichever case happens to run first,
// which made that one case time out only when the suite ran in parallel.
const WARMUP_MS = 60_000;
beforeAll(async () => {
  await eslint.lintText("export default 1;\n", {
    filePath: "src/lib/warmup.ts",
  });
}, WARMUP_MS);

const violations = async (filePath: string, spec: string) => {
  const [result] = await eslint.lintText(`import x from "${spec}";\nexport default x;\n`, {
    filePath,
    warnIgnored: false,
  });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports");
};

const BANNED: ReadonlyArray<[string, string, string]> = [
  // [what it protects, file that must not import, the banned specifier]
  [
    "features must not import routes",
    "src/modules/booking/services/x.ts",
    "@/app/(booking)/checkout/page",
  ],
  [
    "the app shell must not import routes",
    "src/components/layout/x.tsx",
    "@/app/(booking)/checkout/page",
  ],
  ["lib must not import routes", "src/lib/x.ts", "@/app/(booking)/checkout/page"],
  ["utils must not import routes", "src/utils/x.ts", "@/app/(booking)/checkout/page"],
  ["flow must not import routes", "src/flow/x.ts", "@/app/(booking)/checkout/page"],
  ["hooks must not import routes", "src/hooks/x.ts", "@/app/(booking)/checkout/page"],
  ["flow must stay free of React features", "src/flow/x.ts", "@/modules/auth/store/authStore"],
  ["flow must stay free of the app shell", "src/flow/x.ts", "@/components/layout/Footer"],
  [
    "features must not import the app shell",
    "src/modules/booking/services/x.ts",
    "@/components/layout/Footer",
  ],
  ["lib must not import the app shell", "src/lib/x.ts", "@/components/layout/Footer"],
  ["utils must not import features", "src/utils/x.ts", "@/modules/auth/store/authStore"],
  [
    "primitives must not import features",
    "src/modules/shared/ui/X.tsx",
    "@/modules/auth/store/authStore",
  ],
  [
    "primitives must not import the app shell",
    "src/modules/shared/ui/X.tsx",
    "@/components/layout/Footer",
  ],
  ["primitives must not import infrastructure", "src/modules/shared/ui/X.tsx", "@/lib/query/keys"],
  // The primitives block is declared after the features block and both match
  // this path; if that order is reversed the four cases above stop firing.
  [
    "primitives must not import routes",
    "src/modules/shared/ui/X.tsx",
    "@/app/(booking)/checkout/page",
  ],
];

const ALLOWED: ReadonlyArray<[string, string, string]> = [
  // Imports pointing *down* the layer list, which is the whole point.
  [
    "a feature may import another feature",
    "src/modules/booking/services/x.ts",
    "@/modules/auth/store/authStore",
  ],
  [
    "a feature may import primitives",
    "src/modules/booking/services/x.ts",
    "@/modules/shared/ui/Button",
  ],
  ["a feature may import infrastructure", "src/modules/booking/services/x.ts", "@/lib/query/keys"],
  [
    "the app shell may import features",
    "src/components/layout/x.tsx",
    "@/modules/auth/store/authStore",
  ],
  [
    "a route may import anything",
    "src/app/(booking)/checkout/page.tsx",
    "@/components/layout/Footer",
  ],
  ["flow may import infrastructure", "src/flow/x.ts", "@/lib/returnPath"],
  // QueryProvider owns cache identity and so must read the auth store. This is
  // the one lib -> modules edge, and it is deliberate.
  ["lib may read the auth store", "src/lib/query/x.ts", "@/modules/auth/store/authStore"],
];

describe("module boundaries are enforced", () => {
  it.each(BANNED)(
    "%s",
    async (_label, filePath, spec) => {
      expect(await violations(filePath, spec)).toHaveLength(1);
    },
    WARMUP_MS
  );
});

describe("module boundaries do not over-reach", () => {
  it.each(ALLOWED)(
    "%s",
    async (_label, filePath, spec) => {
      expect(await violations(filePath, spec)).toEqual([]);
    },
    WARMUP_MS
  );
});
