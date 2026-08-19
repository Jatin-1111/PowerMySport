import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Module boundaries.
 *
 * `src/` has five layers. Imports may only ever point *down* this list:
 *
 *   src/app          routes, metadata, composition. Imports anything.
 *   src/components   app shell — global chrome (nav, footer, cookie banner) and
 *                    <JsonLd>. Needs the session, so it may reach into modules.
 *   src/modules/*    features. One directory per domain.
 *   src/modules/shared  cross-feature components and the UI primitives (ui/).
 *   src/lib, src/utils, src/flow, src/types  framework-free infrastructure.
 *
 * Every rule below is at zero violations as written — they pin properties the
 * codebase already has rather than declaring aspirations. That matters, because
 * a rule shipped with an allowlist of existing offenders is a rule nobody acts
 * on.
 *
 * Two are load-bearing rather than tidy:
 *
 *   - Nothing outside src/app may import from src/app. A feature that reaches
 *     into a route makes the route un-relocatable and the feature un-reusable,
 *     and it is how import cycles get in. (There was one: sports -> guidance ->
 *     pathway -> sports, via a pathway service filed under sports/.)
 *   - src/flow must not import modules or components. `src/flow/policy.ts` is
 *     reused verbatim by `src/proxy.ts`, which runs before React exists, so one
 *     stray component import there is a build break in the request path.
 *
 * IMPORTANT when editing: flat config resolves a rule by *last matching block
 * wins*, not by merging. Two blocks that both set `no-restricted-imports` and
 * both match a file mean the later one silently erases the earlier one's
 * patterns. So each scope below lists every pattern that applies to it, more
 * specific scopes come last, and `tests/boundaries.test.ts` asserts each rule
 * actually fires — an over-broad or shadowed glob otherwise reports a clean zero
 * and looks like success.
 */

const bans = {
  app: {
    group: ["@/app/*", "@/app/**"],
    message:
      "src/app is the composition layer: it imports from features, never the other way around. Move the shared code into the relevant src/modules/* directory (or src/modules/shared) and import it from both places.",
  },
  components: {
    group: ["@/components/*", "@/components/**"],
    message:
      "src/components is the app shell and sits above features. UI primitives live in @/modules/shared/ui, cross-feature components in @/modules/shared/components.",
  },
  modules: {
    group: ["@/modules/*", "@/modules/**"],
    message:
      "This layer sits below features and cannot depend on them — otherwise every feature transitively depends on every other. Take what you need as props or a parameter.",
  },
  lib: {
    group: ["@/lib/*", "@/lib/**"],
    message:
      "UI primitives must stay self-contained: no data fetching, no query client, no app config. Take what you need as props.",
  },
};

const layer = (name, files, ...banned) => ({
  name: `boundaries/${name}`,
  files,
  rules: {
    "no-restricted-imports": [
      "error",
      { patterns: banned.map((key) => bans[key]) },
    ],
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // App shell: may reach down into features for the session, but not into routes.
  layer("app-shell", ["src/components/**/*.{ts,tsx}"], "app"),

  // Infrastructure: framework-free, owns no UI.
  layer("infrastructure", ["src/utils/**/*.{ts,tsx}", "src/types/**/*.{ts,tsx}"], "app", "components", "modules"),

  // src/lib is infrastructure with one intentional exception: QueryProvider owns
  // cache identity and so must read the auth store. Documented there.
  layer("lib", ["src/lib/**/*.{ts,tsx}"], "app", "components"),

  // Reused by src/proxy.ts outside React.
  layer("flow", ["src/flow/**/*.{ts,tsx}"], "app", "components", "modules"),

  // Legacy top-level hooks. Still consume features, so only routes are banned.
  layer("hooks", ["src/hooks/**/*.{ts,tsx}"], "app"),

  // Features.
  layer("features", ["src/modules/**/*.{ts,tsx}"], "app", "components"),

  // Bottom of the UI graph. Listed last so it wins over "features" above.
  layer("primitives", ["src/modules/shared/ui/**/*.{ts,tsx}"], "app", "components", "modules", "lib"),

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
