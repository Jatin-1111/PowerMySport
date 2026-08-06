import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Default stays `node` so the existing pure-function suites are untouched.
    // Route smoke tests opt into jsdom via a `@vitest-environment jsdom` docblock.
    environment: "node",
    // The setup file no-ops under the `node` environment (it guards on `document`),
    // so it is safe to register globally.
    setupFiles: ["./tests/setup/smokeSetup.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});
