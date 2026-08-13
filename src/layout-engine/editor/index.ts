/**
 * @file Layout-engine editor — public entry point.
 *
 * `LayoutEditor` plus {@link installLayoutEditorOverlay} form a
 * direct-manipulation editing toolkit usable by any application
 * that owns a layout-engine tree. Implement {@link LayoutEditorHost}
 * against your composition, forward pointer events to the editor
 * instance, and mount the overlay on your r3 Stage. The HUD preview
 * page (`src/hud/main.ts`) is the canonical integration reference.
 */

export {
  LayoutEditor,
  ALL_HANDLES,
  HANDLE_SIZE,
  handleRect,
  pointToInsets,
  resizeRect,
  snapTo,
  type EditorEvents,
  type EditorState,
  type EditorViewport,
  type LayoutEditorOptions,
  type ResizeHandle,
  type SkipKeyPredicate,
} from "./editor.ts";

export {
  installLayoutEditorOverlay,
  LAYOUT_EDITOR_OVERLAY_DEPTH,
  type LayoutEditorOverlayHandle,
  type LayoutEditorOverlayOptions,
} from "./overlay.ts";

export type { AnchorPlacement, LayoutEditorHost } from "./types.ts";
