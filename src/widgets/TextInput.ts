/**
 * @file TextInput — r3-faced text input backed by a native DOM input.
 *
 * Canvas-only text editing breaks IME and mobile keyboard behavior.
 * This widget keeps the visible control in r3, while a visually hidden
 * HTMLInputElement owns actual text entry, composition, and focus.
 *
 * ## Multi-line display
 *
 * The native element is a single-line `<input>`, but the visible echo
 * wraps: the value is laid out through the shared text raster pipeline
 * ({@link layoutTextRaster}, 行頭禁則-aware) so the wrapped lines, the
 * caret, and the IME composition underline all agree with what the
 * `Text` label actually paints. The box keeps its bottom edge fixed at
 * the single-line position and grows upward as lines accumulate;
 * `onHeightChange` lets the owning scene re-flow neighbours (log,
 * backdrop) around the grown box.
 *
 * ## IME Enter handling
 *
 * Enter must submit only once composition is settled. Chrome/Firefox
 * mark the conversion-confirming Enter with `isComposing`, but Safari
 * fires `compositionend` BEFORE that keydown and clears `isComposing`
 * on it — its only remaining marker is the legacy `keyCode === 229`.
 * All three signals are checked so the confirm-Enter never submits and
 * the next plain Enter always does.
 */

import { Container } from "../Container.ts";
import { Rect } from "../Rect.ts";
import { Text } from "../Text.ts";
import { layoutTextRaster, type TextRasterSpec } from "../text-raster.ts";
import {
  buildFontShorthand,
  type FontStyleSpec,
  type MeasureFn,
  type WrappedLine,
} from "../text-metrics.ts";
import type { TextureManager } from "../texture-canvas";
import { COLOR, FONT } from "../theme";

const BORDER = COLOR.GOLD;
const FOCUS_BORDER = "#f2cf6b";
const FILL = "#f8edd8";
const TEXT_COLOR = COLOR.INK_TEXT;
const PLACEHOLDER_COLOR = COLOR.BROWN_SOFT;
const CARET_COLOR = COLOR.INK_TEXT;
const COMPOSITION_UNDERLINE = COLOR.GOLD;
/**
 * Line-height multiplier for the wrapped echo. Wider than Text's 1.2
 * default so the composition underline drawn under a line's descent
 * doesn't collide with the next line's glyph tops.
 */
const LINE_HEIGHT = 1.4;
/** Horizontal inset between the box border and the text column. */
const PAD_X = 16;

export type R3TextInputOptions = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** Height of the single-line box; the minimum box height. */
  readonly height: number;
  readonly value?: string;
  readonly placeholder?: string;
  readonly maxLength?: number;
  /** Corner radius of the box — chat-composer styling. Defaults to 0. */
  readonly cornerRadius?: number;
  /** Accessible name announced for the hidden native input. */
  readonly ariaLabel?: string;
  /**
   * `autocomplete` attribute of the native input. Defaults to "off";
   * pass a real token (e.g. "nickname") where browser autofill is
   * actually meaningful for the field.
   */
  readonly autocomplete?: string;
  readonly textureManager: TextureManager;
  readonly onChange?: (value: string) => void;
  readonly onSubmit?: (value: string) => void;
  readonly onCancel?: () => void;
  /**
   * Fired when wrapping changes the visible box height. The box keeps
   * its bottom edge fixed (at local `+height / 2`) and grows upward,
   * so the owner only needs to push upward-neighbours out of the way.
   */
  readonly onHeightChange?: (boxHeight: number) => void;
};

export type R3TextInputHandle = {
  readonly node: Container;
  readonly value: () => string;
  readonly setValue: (value: string) => void;
  readonly focus: () => void;
  /** Current visible box height (>= options.height once text wraps). */
  readonly boxHeight: () => number;
  readonly destroy: () => void;
};

/**
 * True when `element` is the hidden native `<input>` a
 * {@link createR3TextInput} widget owns — identified by the
 * `data-r3-text-input="true"` marker `createHiddenInput` sets.
 * Callers use this to tell an r3 text input apart from any other
 * focused element (e.g. deciding whether to suppress a global
 * keyboard shortcut while text entry is focused).
 */
export function isR3TextInputElement(element: Element | null): boolean {
  return element instanceof HTMLInputElement && element.dataset.r3TextInput === "true";
}

/** Caret line/offset with wrap-boundary affinity resolved. */
type CaretPos = {
  readonly line: number;
  /** UTF-16 offset within the line's text. */
  readonly offset: number;
};

/**
 * At a soft-wrap boundary an index belongs to two visual positions:
 * end of the previous line and start of the next. "forward" picks the
 * next-line start (where the next typed glyph lands — right for the
 * caret); "backward" picks the previous-line end (right for the end of
 * a highlight range, e.g. the composition underline).
 */
type CaretAffinity = "forward" | "backward";

/** Creates a visible r3 text input whose editing state is owned by a hidden native input. */
export function createR3TextInput(options: R3TextInputOptions): R3TextInputHandle {
  const root = new Container({ x: options.x, y: options.y, name: "r3:text-input" });
  const maxLength = options.maxLength ?? 40;
  const fontSize = Math.max(18, Math.floor(options.height * 0.42));
  const font: FontStyleSpec = { family: FONT.MINCHO, size: fontSize, weight: "bold" };
  const textLeft = -options.width / 2 + PAD_X;
  const textMaxWidth = options.width - PAD_X * 2;
  /** Fixed bottom edge of the box in node-local pixels. */
  const bottomY = options.height / 2;
  const input = createHiddenInput({
    maxLength,
    value: options.value ?? "",
    fontSize,
    width: textMaxWidth,
    height: options.height,
    ariaLabel: options.ariaLabel ?? "",
    autocomplete: options.autocomplete ?? "off",
  });
  const measure = createTextMeasure(font);
  const state = {
    focused: false,
    composing: false,
    compositionStart: 0,
  };
  /**
   * Line layout snapshot of the latest sync, in node-local pixels.
   * `lines` always describes the VALUE (never the placeholder) so
   * caret/underline math doesn't index into placeholder glyphs.
   */
  const metrics = {
    lines: [{ text: "", width: 0 }] as readonly WrappedLine[],
    labelTop: -options.height / 2,
    padding: 2,
    ascent: fontSize * 0.8,
    descent: fontSize * 0.2,
    lineAdvance: fontSize * LINE_HEIGHT,
    boxHeight: options.height,
  };
  const frameSync: { dispose: (() => void) | null } = { dispose: null };

  const bg = new Rect({
    width: options.width,
    height: options.height,
    fill: FILL,
    fillAlpha: 1,
    strokeColor: BORDER,
    strokeWidth: 2,
    strokeAlpha: 1,
    cornerRadius: options.cornerRadius ?? 0,
    originX: 0.5,
    originY: 0.5,
    interactive: true,
    textureManager: options.textureManager,
  });
  root.add(bg);

  // The label's raster spec must stay field-for-field identical to
  // `rasterSpec()` below — caret positions are derived from
  // layoutTextRaster on that spec and must match the painted glyphs.
  const label = new Text({
    text: "",
    font,
    color: TEXT_COLOR,
    align: "left",
    lineHeight: LINE_HEIGHT,
    maxWidth: textMaxWidth,
    ellipsis: false,
    padding: 2,
    originX: 0,
    originY: 0,
    textureManager: options.textureManager,
  });
  label.setPosition(textLeft, metrics.labelTop);
  root.add(label);

  const caret = new Rect({
    width: 2,
    height: Math.max(24, Math.floor(options.height * 0.54)),
    fill: CARET_COLOR,
    fillAlpha: 1,
    originX: 0.5,
    originY: 0.5,
    visible: false,
    textureManager: options.textureManager,
  });
  root.add(caret);

  /** One underline Rect per wrapped line the composition range spans. */
  const underlinePool: Rect[] = [];

  function rasterSpec(text: string): TextRasterSpec {
    return {
      text,
      font,
      color: TEXT_COLOR,
      align: "left",
      lineHeight: LINE_HEIGHT,
      letterSpacing: 0,
      maxWidth: textMaxWidth,
      maxLines: Infinity,
      ellipsis: false,
      padding: 2,
      stroke: null,
    };
  }

  function displayText(): string {
    if (input.value.length > 0) {
      return input.value;
    }
    return options.placeholder ?? "";
  }

  function syncLabel(): void {
    const text = displayText();
    const hasValue = input.value.length > 0;
    label.setText(text);
    label.setColor(hasValue ? TEXT_COLOR : PLACEHOLDER_COLOR);
    bg.setStroke(state.focused ? FOCUS_BORDER : BORDER, state.focused ? 3 : 2);

    // Same layout pipeline (and measurement context) the Text label's
    // raster uses, so line breaks here are exactly the painted ones.
    const layout = layoutTextRaster(rasterSpec(text), null, options.textureManager);
    const lineCount = Math.max(1, layout.lines.length);
    // layoutTextRaster doesn't expose descent; recover it from the
    // height identity cssHeight = ceil(ascent + descent + (n-1)·advance
    // + 2·padding) — the ≤1px ceil slack is irrelevant at caret scale.
    const descent = Math.max(
      0,
      layout.cssHeight - layout.padding * 2 - layout.ascent - (lineCount - 1) * layout.lineAdvance,
    );
    const oneLineCssHeight = Math.ceil(layout.ascent + descent + layout.padding * 2);
    // Vertical inset that centres a single line inside options.height;
    // kept constant as lines accumulate so the box grows by exactly
    // the label's growth.
    const inset = Math.max(0, (options.height - oneLineCssHeight) / 2);
    const boxHeight = Math.max(options.height, layout.cssHeight + inset * 2);
    const boxTop = bottomY - boxHeight;

    metrics.lines = hasValue ? layout.lines : [{ text: "", width: 0 }];
    metrics.labelTop = boxTop + inset;
    metrics.padding = layout.padding;
    metrics.ascent = layout.ascent;
    metrics.descent = descent;
    metrics.lineAdvance = layout.lineAdvance;

    bg.setSize(options.width, boxHeight);
    bg.setPosition(0, bottomY - boxHeight / 2);
    label.setPosition(textLeft, metrics.labelTop);

    syncCaret();
    syncCompositionUnderline();
    syncNativeInputGeometry();

    if (boxHeight !== metrics.boxHeight) {
      metrics.boxHeight = boxHeight;
      options.onHeightChange?.(boxHeight);
    }
  }

  function setValue(value: string): void {
    input.value = value.slice(0, maxLength);
    syncLabel();
    options.onChange?.(input.value);
  }

  function clampSelection(index: number): number {
    return Math.max(0, Math.min(input.value.length, index));
  }

  function selectionIndex(): number {
    return clampSelection(input.selectionStart ?? input.value.length);
  }

  /**
   * Maps a UTF-16 index in the value onto a wrapped (line, offset)
   * pair. Wrapped lines concatenate back to the original value (the
   * wrap rules only move characters between lines), so cumulative
   * line lengths partition the index space exactly.
   */
  function caretPosForIndex(index: number, affinity: CaretAffinity): CaretPos {
    const lines = metrics.lines;
    const cursor = { remaining: clampSelection(index) };
    for (let k = 0; k < lines.length; k++) {
      const len = lines[k]?.text.length ?? 0;
      if (
        cursor.remaining < len ||
        (cursor.remaining === len && (affinity === "backward" || k === lines.length - 1))
      ) {
        return { line: k, offset: cursor.remaining };
      }
      cursor.remaining -= len;
    }
    const last = lines.length - 1;
    return { line: last, offset: lines[last]?.text.length ?? 0 };
  }

  /** Node-local y of line `k`'s glyph-box top (baseline − ascent). */
  function lineTopY(line: number): number {
    return metrics.labelTop + metrics.padding + line * metrics.lineAdvance;
  }

  function caretXForPos(pos: CaretPos): number {
    const lineText = metrics.lines[pos.line]?.text ?? "";
    const measured = measure(lineText.slice(0, pos.offset));
    return textLeft + metrics.padding + Math.min(textMaxWidth, measured);
  }

  function syncCaret(): void {
    caret.setVisible(state.focused);
    if (!caret.visible) {
      return;
    }
    const pos = caretPosForIndex(selectionIndex(), "forward");
    const lineBox = metrics.ascent + metrics.descent;
    caret.setSize(2, Math.ceil(lineBox) + 2);
    caret.setPosition(caretXForPos(pos), lineTopY(pos.line) + lineBox / 2);
  }

  function syncCompositionUnderline(): void {
    const active = state.focused && state.composing;
    if (!active) {
      for (const seg of underlinePool) {
        seg.setVisible(false);
      }
      return;
    }
    const startIdx = clampSelection(state.compositionStart);
    const endIdx = selectionIndex();
    const head = caretPosForIndex(Math.min(startIdx, endIdx), "forward");
    const tail = caretPosForIndex(Math.max(startIdx, endIdx), "backward");
    const underlineY = (line: number): number =>
      lineTopY(line) + metrics.ascent + metrics.descent + 2;
    const lineEndX = (line: number): number =>
      textLeft + metrics.padding + Math.min(textMaxWidth, metrics.lines[line]?.width ?? 0);
    const segments = { drawn: 0 };
    for (let k = head.line; k <= tail.line; k++) {
      const x1 = k === head.line ? caretXForPos(head) : textLeft + metrics.padding;
      const x2 = k === tail.line ? caretXForPos(tail) : lineEndX(k);
      const seg = underlineSegment(segments.drawn);
      seg.setVisible(true);
      seg.setPosition(x1, underlineY(k));
      seg.setSize(Math.max(2, x2 - x1), 2);
      segments.drawn += 1;
    }
    for (let i = segments.drawn; i < underlinePool.length; i++) {
      underlinePool[i]?.setVisible(false);
    }
  }

  function underlineSegment(index: number): Rect {
    const existing = underlinePool[index];
    if (existing) {
      return existing;
    }
    const seg = new Rect({
      width: 1,
      height: 2,
      fill: COMPOSITION_UNDERLINE,
      fillAlpha: 1,
      originX: 0,
      originY: 0.5,
      visible: false,
      textureManager: options.textureManager,
    });
    root.add(seg);
    underlinePool.push(seg);
    return seg;
  }

  /** UTF-16 offset of line `line`'s first character within the full value. */
  function lineStartOffset(lines: readonly WrappedLine[], line: number): number {
    return lines.slice(0, line).reduce((sum, l) => sum + l.text.length, 0);
  }

  /** Maps a node-local click point onto the nearest caret index. */
  function caretIndexForPoint(localX: number, localY: number): number {
    const lines = metrics.lines;
    const rawLine = Math.floor((localY - metrics.labelTop - metrics.padding) / metrics.lineAdvance);
    const line = Math.max(0, Math.min(lines.length - 1, rawLine));
    const relX = localX - (textLeft + metrics.padding);
    const base = lineStartOffset(lines, line);
    const lineText = lines[line]?.text ?? "";
    const glyphs = Array.from(lineText);
    const state = { consumed: "" };
    for (const ch of glyphs) {
      const before = measure(state.consumed);
      const after = measure(state.consumed + ch);
      if (relX < (before + after) / 2) {
        return base + state.consumed.length;
      }
      state.consumed += ch;
    }
    return base + lineText.length;
  }

  /**
   * IME-owned keystrokes must not trigger submit/cancel. `isComposing`
   * covers Chrome/Firefox; Safari clears it on the conversion-confirm
   * Enter (compositionend fires first) but still stamps the legacy
   * `keyCode` 229 on it.
   */
  function isImeKeystroke(event: KeyboardEvent): boolean {
    return event.isComposing || state.composing || event.keyCode === 229;
  }

  const onInput = (): void => {
    syncLabel();
    if (state.composing) {
      return;
    }
    options.onChange?.(input.value);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isImeKeystroke(event)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      options.onSubmit?.(input.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      options.onCancel?.();
    }
  };
  const onFocus = (): void => {
    state.focused = true;
    startNativeInputGeometrySync();
    syncLabel();
  };
  const onBlur = (): void => {
    state.focused = false;
    state.composing = false;
    stopNativeInputGeometrySync();
    syncLabel();
  };
  const onCompositionStart = (): void => {
    state.composing = true;
    state.compositionStart = input.selectionStart ?? input.value.length;
    syncLabel();
  };
  const onCompositionUpdate = (): void => {
    state.composing = true;
    syncLabel();
  };
  const onCompositionEnd = (): void => {
    state.composing = false;
    syncLabel();
    options.onChange?.(input.value);
  };
  const onSelectionChange = (): void => {
    if (document.activeElement !== input) {
      return;
    }
    syncLabel();
  };

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onKeyDown);
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);
  input.addEventListener("compositionstart", onCompositionStart);
  input.addEventListener("compositionupdate", onCompositionUpdate);
  input.addEventListener("compositionend", onCompositionEnd);
  input.addEventListener("keyup", syncLabel);
  input.addEventListener("mouseup", syncLabel);
  document.addEventListener("selectionchange", onSelectionChange);
  bg.on("pointerdown", (event) => {
    input.focus();
    if (!state.composing) {
      // event.localX/Y are in bg's frame (its centre); shift into the
      // root frame the line metrics live in. Repositioning the native
      // selection mid-composition would detonate the IME session.
      const bgCenterY = bottomY - metrics.boxHeight / 2;
      const index = caretIndexForPoint(event.localX, bgCenterY + event.localY);
      input.setSelectionRange(index, index);
    }
    syncLabel();
  });
  syncLabel();

  return {
    node: root,
    value: () => input.value,
    setValue,
    focus: () => {
      input.focus();
    },
    boxHeight: () => metrics.boxHeight,
    destroy: () => {
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("compositionstart", onCompositionStart);
      input.removeEventListener("compositionupdate", onCompositionUpdate);
      input.removeEventListener("compositionend", onCompositionEnd);
      input.removeEventListener("keyup", syncLabel);
      input.removeEventListener("mouseup", syncLabel);
      document.removeEventListener("selectionchange", onSelectionChange);
      stopNativeInputGeometrySync();
      input.remove();
      root.destroy();
    },
  };

  function startNativeInputGeometrySync(): void {
    syncNativeInputGeometry();
    if (frameSync.dispose !== null) {
      return;
    }
    const stage = root.stage;
    if (stage === null) {
      return;
    }
    frameSync.dispose = stage.onFrame(syncNativeInputGeometry);
  }

  function stopNativeInputGeometrySync(): void {
    frameSync.dispose?.();
    frameSync.dispose = null;
  }

  /**
   * Keeps the hidden input glued to the caret's wrapped line (not the
   * whole box): the browser anchors the IME candidate window to the
   * native element, so tracking the line keeps candidates next to the
   * text actually being composed.
   */
  function syncNativeInputGeometry(): void {
    const pos = caretPosForIndex(selectionIndex(), "forward");
    const lineBox = metrics.ascent + metrics.descent;
    const geometry = measureNativeInputGeometry({
      root,
      localLeft: textLeft,
      localTop: lineTopY(pos.line) - 2,
      width: textMaxWidth,
      height: lineBox + 4,
      fontSize,
    });
    applyNativeInputGeometry(input, geometry);
  }
}

type HiddenInputOptions = {
  readonly maxLength: number;
  readonly value: string;
  readonly fontSize: number;
  readonly width: number;
  readonly height: number;
  readonly ariaLabel: string;
  readonly autocomplete: string;
};

function createHiddenInput(options: HiddenInputOptions): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.dataset.r3TextInput = "true";
  input.setAttribute("autocomplete", options.autocomplete);
  input.inputMode = "text";
  input.maxLength = options.maxLength;
  input.value = options.value.slice(0, options.maxLength);
  input.setAttribute("aria-label", options.ariaLabel);
  input.style.position = "fixed";
  input.style.left = "0";
  input.style.top = "0";
  input.style.width = `${String(Math.max(1, options.width))}px`;
  input.style.height = `${String(Math.max(1, options.height))}px`;
  input.style.opacity = "0.01";
  input.style.pointerEvents = "none";
  input.style.zIndex = "0";
  input.style.margin = "0";
  input.style.padding = "0";
  input.style.border = "0";
  input.style.outline = "0";
  input.style.background = "transparent";
  input.style.color = "transparent";
  input.style.caretColor = "transparent";
  input.style.fontFamily = FONT.MINCHO;
  input.style.fontSize = `${String(options.fontSize)}px`;
  input.style.fontWeight = "bold";
  input.style.lineHeight = `${String(options.height)}px`;
  document.body.append(input);
  return input;
}

type NativeInputGeometry = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
};

function measureNativeInputGeometry(options: {
  readonly root: Container;
  readonly localLeft: number;
  readonly localTop: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}): NativeInputGeometry {
  const stage = options.root.stage;
  const canvas = stage?.renderer?.domElement ?? null;
  const rect = canvas?.getBoundingClientRect();
  const world = options.root.getWorldPosition();
  const scaleX =
    rect && stage !== null && stage.screen.width > 0 ? rect.width / stage.screen.width : 1;
  const scaleY =
    rect && stage !== null && stage.screen.height > 0 ? rect.height / stage.screen.height : 1;
  return {
    left: (rect?.left ?? 0) + (world.x + options.localLeft) * scaleX,
    top: (rect?.top ?? 0) + (world.y + options.localTop) * scaleY,
    width: Math.max(1, options.width * scaleX),
    height: Math.max(1, options.height * scaleY),
    fontSize: Math.max(1, options.fontSize * scaleY),
  };
}

function applyNativeInputGeometry(input: HTMLInputElement, geometry: NativeInputGeometry): void {
  input.style.left = `${String(geometry.left)}px`;
  input.style.top = `${String(geometry.top)}px`;
  input.style.width = `${String(geometry.width)}px`;
  input.style.height = `${String(geometry.height)}px`;
  input.style.fontSize = `${String(geometry.fontSize)}px`;
  input.style.lineHeight = `${String(geometry.height)}px`;
}

/**
 * Prefix-width measurer for caret math. The font shorthand is built
 * with the same {@link buildFontShorthand} the raster layout uses, so
 * widths agree with the wrapped lines to sub-pixel precision.
 */
function createTextMeasure(font: FontStyleSpec): MeasureFn {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return (text) => text.length * font.size * 0.55;
  }
  ctx.font = buildFontShorthand(font);
  return (text) => (text.length === 0 ? 0 : ctx.measureText(text).width);
}
