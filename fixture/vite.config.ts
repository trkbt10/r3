/**
 * @file Vite config for the @trkbt10/r3 consumer fixture app.
 *
 * This app exists to prove the library works from a real browser as
 * a real external consumer would use it: it imports ONLY the built
 * `../dist` output, never `../src`. The alias table below rewrites
 * every `@trkbt10/r3*` specifier onto the matching file under
 * `../dist`, mirroring this package's own `package.json` `exports`
 * map (see the root README's "Subpath exports" table) instead of
 * relying on Node's package-exports resolution, because Vite dev/
 * build both resolve through this project's own `node_modules`
 * (there is no local install of `@trkbt10/r3` under itself), and
 * pointing straight at `dist/` is the simplest way to guarantee this
 * fixture only ever sees the same artifact `npm publish` would ship.
 *
 * ## Why order matters here
 *
 * Vite's alias resolution (via `@rollup/plugin-alias`) tries entries
 * in array order and matches by string prefix, so a shorter alias
 * registered first would shadow every longer one that starts with
 * it — e.g. `"@trkbt10/r3"` before `"@trkbt10/r3/layout-engine"`
 * would intercept `@trkbt10/r3/layout-engine` imports too and
 * resolve them (wrongly) against the root barrel. Every subpath
 * alias is therefore listed before the bare package-name alias.
 */
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const distDir = fileURLToPath(new URL("../dist", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@trkbt10/r3/layout-engine/editor", replacement: `${distDir}/layout-engine/editor/index.js` },
      { find: "@trkbt10/r3/layout-engine", replacement: `${distDir}/layout-engine/index.js` },
      { find: "@trkbt10/r3/widgets/panel-effects", replacement: `${distDir}/widgets/panel-effects/index.js` },
      { find: "@trkbt10/r3/spotlight", replacement: `${distDir}/spotlight/index.js` },
      { find: "@trkbt10/r3/texture-canvas", replacement: `${distDir}/texture-canvas/index.js` },
      { find: "@trkbt10/r3", replacement: `${distDir}/index.js` },
    ],
  },
  build: {
    // Overridden by `--outDir` from the Makefile `fixture` target;
    // this default only applies to an ad-hoc local `vite build` run
    // from inside fixture/ without the Makefile.
    outDir: "dist",
  },
});
