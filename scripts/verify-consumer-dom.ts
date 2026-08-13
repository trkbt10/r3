/**
 * @file DOM-shim installer for scripts/verify-consumer.ts.
 *
 * Plain Node has no `window`/`document`. Several r3 modules read
 * those globals (or DOM constructors reachable only through them)
 * directly — `src/widgets/Dialog.ts`'s `window.setTimeout`,
 * `src/widgets/TextInput.ts`'s hidden native `<input>`,
 * `src/image-loading/index.ts`'s default provider (consumed by
 * `src/widgets/Panel.ts`'s HUD wood-grain overlay, and therefore by
 * `Plaque`) constructing a bare `new Image()`, and
 * `src/canvasPointerBridge.ts`'s consumer-side exercise in
 * verify-consumer.ts dispatching real `new MouseEvent(...)` instances
 * at a canvas element — see verify-consumer.ts's file header for the
 * full rationale. This module's only job is to install happy-dom's
 * real `Window` implementation as those globals as an import-time
 * side effect, so that importing this module before importing
 * `@trkbt10/r3` is sufficient to make every r3 code path that reads
 * `window`, `document`, `Image`, or `MouseEvent` see a real (if
 * canvas-2D-less) DOM instead of throwing `ReferenceError`.
 *
 * `happy-dom` is a `devDependency` of this package already (see
 * package.json) — this does not add a new dependency, and it is the
 * same DOM implementation this package's own Vitest specs use via
 * the `@vitest-environment happy-dom` pragma comment.
 *
 * ## Why `Object.defineProperty`, not a plain assignment
 *
 * happy-dom's `Window`/`Document`/`OffscreenCanvas`/etc. classes are
 * an independent structural modelling of the DOM, not literally
 * TypeScript's `lib.dom.d.ts` types — assigning
 * `globalThis.window = happyDomWindow` fails to typecheck because the
 * two `Window` shapes disagree on dozens of unrelated members neither
 * this script nor r3 ever touches. This repository's ESLint config
 * bans `as any`/`as unknown` type assertions entirely (see
 * eslint/rules/rules-restricted-syntax.js) as a way to force a real
 * fix instead of papering over a type mismatch, so those are not an
 * option here either. `Object.defineProperty`'s own
 * `PropertyDescriptor.value` is typed `any` in `lib.es5.d.ts` — that
 * is TypeScript's own sanctioned seam for exactly this situation
 * (installing a runtime value onto a global whose static type is
 * intentionally broader than any single implementation), so using it
 * is the correct tool, not a workaround.
 */
import { Window } from "happy-dom";

const happyDomWindow = new Window({ url: "http://localhost/" });

/** Installs `value` as a configurable, enumerable global with the given name. */
function installGlobal(name: string, value: object): void {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

installGlobal("window", happyDomWindow);
installGlobal("document", happyDomWindow.document);
installGlobal("OffscreenCanvas", happyDomWindow.OffscreenCanvas);
installGlobal("HTMLInputElement", happyDomWindow.HTMLInputElement);
installGlobal("HTMLCanvasElement", happyDomWindow.HTMLCanvasElement);
installGlobal("Element", happyDomWindow.Element);
installGlobal("Image", happyDomWindow.Image);
installGlobal("MouseEvent", happyDomWindow.MouseEvent);
