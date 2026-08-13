/**
 * @file Vite build configuration.
 *
 * `three` ships ESM-only from ^0.184 (no usable CommonJS entry), so
 * this package builds ESM-only too: a CJS bundle would be unusable
 * by any consumer's `require()` because it would immediately need to
 * `require("three")`, which fails. Every public entry point (the
 * root barrel plus the subpath-exported sub-barrels declared in
 * `package.json`'s `exports`) gets its own bundle so `import
 * "@trkbt10/r3/layout-engine"` doesn't pull in the whole package.
 */

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["**/*.spec.ts"],
    }),
  ],
  build: {
    outDir: "dist",
    lib: {
      entry: {
        index: "src/index.ts",
        "layout-engine/index": "src/layout-engine/index.ts",
        "layout-engine/editor/index": "src/layout-engine/editor/index.ts",
        "widgets/panel-effects/index": "src/widgets/panel-effects/index.ts",
        "spotlight/index": "src/spotlight/index.ts",
        "texture-canvas/index": "src/texture-canvas/index.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/node:.+/, "three"],
    },
  },
});
