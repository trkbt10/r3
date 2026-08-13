/**
 * @file Vitest testing framework configuration for @trkbt10/r3.
 *
 * Test files use the globals (`describe`/`it`/`expect`) injected by
 * the runner rather than importing them, so `globals: true`. The
 * default environment is `"node"`; individual spec files that need a
 * DOM (canvas, `HTMLImageElement`, pointer events) opt in per-file
 * via a `@vitest-environment happy-dom` pragma comment rather than
 * paying the DOM setup cost for every test in the suite.
 */

import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    include: ["src/**/*.spec.ts", "spec/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
    },
  },
});
