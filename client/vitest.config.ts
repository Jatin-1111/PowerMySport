import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default stays node so the pure-logic suite keeps running in under a
    // second. Tests that render opt in with a `@vitest-environment jsdom`
    // docblock — booting jsdom for all files took the suite from 0.8s to 30s,
    // and a slow suite is a suite people stop running.
    //
    // The point of the jsdom support is that it exists at all: the suite used
    // to be node-only, so guards, redirects and step transitions could not be
    // tested, and the flow logic most in need of protection was the only logic
    // that could not be protected.
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
});
