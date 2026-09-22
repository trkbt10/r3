/**
 * @file Pure text-measurement / line-wrap helpers, decoupled from Three.
 *
 * Splitting the wrap logic from {@link Text} keeps the user's explicit
 * concern — Canvas-API-driven measurement and proper Japanese line
 * wrapping with 行頭禁則 — testable without WebGL or even a DOM
 * canvas (the harness passes a measure function).
 *
 * ## Measurement model
 *
 * The renderer must know, per line of text:
 *  - the line's pixel width
 *  - the baseline ascent / descent so multi-line layout reserves the
 *    correct vertical space and so the OffscreenCanvas the texture
 *    uses can be sized just large enough
 *
 * The wrap algorithm itself only consumes a single primitive:
 *
 *   `measure(text) => { width }`
 *
 * which closes over the configured Canvas 2D context (font, etc.) at
 * construction. Tests inject a synthetic measure (each codepoint = 1
 * unit) so the wrapping rules can be exercised without a font.
 *
 * ## Line wrap with 禁則処理 (JIS X 4051-style line-break rules)
 *
 * Japanese typography forbids certain break positions. Three rule
 * families are honoured here:
 *
 *   - 行頭禁則 — characters that must not START a line: closing
 *     brackets/quotes, sentence punctuation, middle dots, small kana,
 *     the prolonged-sound mark, iteration marks.
 *   - 行末禁則 — characters that must not END a line: opening
 *     brackets/quotes.
 *   - 分離禁則 — runs that must not be split: leaders and dashes
 *     （……、――）. Encoded by making every leader/dash character
 *     行頭禁則, so the run's tail can never be orphaned onto the
 *     next line.
 *
 * The greedy algorithm with 追い出し (push-out):
 *   1. Walk codepoints; accumulate while the current line fits
 *      within `maxWidth`.
 *   2. On overflow, the natural break is before the overflowing
 *      codepoint. Walk the break position BACK toward the line start
 *      until both sides are legal — the new line's head is not
 *      行頭禁則 and the old line's tail is not 行末禁則. Characters
 *      walked past are pushed down to the next line (追い出し).
 *   3. If no legal break exists anywhere in the line (a pathological
 *      run like 「、、、、」), fall back to ぶら下げ: the prohibited
 *      run hangs on the current line past `maxWidth`. This keeps the
 *      algorithm deterministic and loop-free.
 *
 * Hard newlines in the input always break, regardless of width.
 * Across every rule, the wrapped lines concatenate back to the input
 * (per hard line) — callers rely on that to map string indices onto
 * (line, offset) pairs.
 */
/** A short-circuit measurement primitive: text → width-in-pixels. */
export type MeasureFn = (text: string) => number;
export type WrapOptions = {
    /**
     * Maximum width (in the same unit `measure` returns). Pass
     * `Infinity` to disable wrapping (only hard newlines split).
     */
    readonly maxWidth: number;
    readonly measure: MeasureFn;
};
/** One wrapped line with its measured width. */
export type WrappedLine = {
    readonly text: string;
    readonly width: number;
};
/**
 * Splits `text` into wrapped lines.
 *
 * - Iterates codepoints (not UTF-16 units), so surrogate pairs and
 *   emoji are treated as one character apiece.
 * - Hard `\n` always introduces a break.
 * - On overflow, tries to keep 行頭禁則 characters off the start of
 *   each new line by walking one character back; will not loop
 *   (the prior-line overflow is tolerated to stay deterministic).
 */
export declare function wrapText(text: string, options: WrapOptions): WrappedLine[];
/** Concrete text-style fields used to build a `font:` shorthand. */
export type FontStyleSpec = {
    readonly family: string;
    readonly size: number;
    readonly weight?: "normal" | "bold" | number;
    readonly style?: "normal" | "italic";
};
/** Builds a CSS `font:` shorthand from the typed pieces. */
export declare function buildFontShorthand(spec: FontStyleSpec): string;
/** Snapshot of the metric values returned by `ctx.measureText`. */
export type CanvasMetricSnapshot = {
    readonly width: number;
    readonly ascent: number;
    readonly descent: number;
};
/**
 * Reads ascent / descent from a TextMetrics object with a sensible
 * fallback. Older browsers (and OffscreenCanvas under jsdom) leave
 * the actual* fields undefined; we fall back to font-size-based
 * approximations so layout doesn't collapse to zero.
 */
export declare function snapshotMetrics(metrics: TextMetrics, fontSize: number): CanvasMetricSnapshot;
/**
 * Default compression ladder used by {@link fitTextToBox}. Picked so
 * each step is a noticeable-but-subtle change: at 0.95 the run reads
 * as normal Japanese, at 0.85–0.80 it reads as slightly tall/narrow.
 */
export declare const FIT_SCALE_CANDIDATES: readonly number[];
export type FitTextToBoxOptions = {
    readonly text: string;
    readonly measure: MeasureFn;
    /** Display width the caller wants the rendered text to fit inside. */
    readonly maxWidthPx: number;
    /**
     * Ideal line count — the fit tries every ladder step at this count
     * first. For "a 2–3 line flavor box" pass 3.
     */
    readonly preferredLines: number;
    /**
     * Absolute line cap — if the preferred count can't be reached even
     * at max compression, the fit walks the ladder again at `hardMax`.
     * Past that, text is truncated. Pass the physical line budget the
     * box can render without overflowing.
     */
    readonly hardMax: number;
    /**
     * Optional ladder override. Must be sorted largest → smallest and
     * every value must be in `(0, 1]`.
     */
    readonly candidates?: readonly number[];
};
export type FitTextToBoxResult = {
    /** Wrapped lines (respects 行頭禁則 via {@link wrapText}). */
    readonly lines: readonly WrappedLine[];
    /**
     * Horizontal scale the caller should apply to the rendered text
     * (e.g. `ctx.scale(scaleX, 1)` or `Node.setScale(scaleX, 1)`). The
     * wrap measurements above were made against `maxWidthPx / scaleX`
     * so the post-scale display width equals the caller's requested
     * `maxWidthPx` for every ladder step.
     */
    readonly scaleX: number;
    /** `true` when the text overruns even at max compression. */
    readonly truncated: boolean;
};
export type FitTextWithFontLadderOptions = {
    readonly text: string;
    /**
     * Produces a measure fn for a given font size. Callers typically
     * close over a ctx and set `ctx.font` inside. The returned fn is
     * expected to be stable for the duration of one iteration (the
     * ladder only calls it while the font is set to the matching size).
     */
    readonly makeMeasure: (fontSizePx: number) => MeasureFn;
    readonly maxWidthPx: number;
    readonly maxHeightPx: number;
    /** Preferred number of lines at the chosen font size. */
    readonly preferredLines: number;
    /**
     * Font-size ladder, largest → smallest. Each is tried in order;
     * the first that produces `truncated: false` wins. The smallest
     * entry is the fallback even when it too truncates.
     */
    readonly fontSizePx: readonly number[];
    /** Line-height multiplier (line = fontSize × lineHeightRatio). */
    readonly lineHeightRatio: number;
    /** Horizontal-compression candidates (see {@link fitTextToBox}). */
    readonly scaleCandidates?: readonly number[];
};
export type FitTextWithFontLadderResult = FitTextToBoxResult & {
    /** Font size the caller should actually render at. */
    readonly fontSizePx: number;
};
/**
 * Wraps + compresses `text` to fit inside a text-box with bounded
 * width and bounded line count. The canonical "Japanese text-box"
 * operation used by every card-face text that can overflow:
 *
 *   1. Clamp `preferredLines` to `hardMax` so small boxes don't try
 *      to wrap more lines than they can render.
 *   2. Walk the compression ladder (`scaleX = 1 → 0.8`). For each
 *      step, wrap `text` at `maxWidthPx / scaleX` using the shared
 *      {@link wrapText} (行頭禁則-aware). First scale that produces
 *      ≤ `effective` lines wins — no compression beyond what's
 *      necessary.
 *   3. If no scale hits `effective`, walk the ladder again at the
 *      full `hardMax`: two lines of mildly-squeezed text is nicer
 *      than three lines of heavily-squished text.
 *   4. Final fallback truncates at `hardMax` with max compression.
 *
 * Both the Canvas2D-baked shader path and the r3 Text-based composed
 * path consume this result so their wrap + compression behaviour is
 * identical. The measurement primitive is the caller's responsibility
 * (Canvas2D wires `ctx.measureText`; r3 Text wires its cached
 * measurement context), which keeps this helper free of any DOM /
 * WebGL assumptions.
 */
export declare function fitTextToBox(options: FitTextToBoxOptions): FitTextToBoxResult;
/**
 * Top-level Japanese text-box fit. Walks a **font-size ladder** from
 * largest → smallest, and for each size runs {@link fitTextToBox}
 * (horizontal compression + 行頭禁則-aware wrap). The first font size
 * whose fit does not truncate wins; if every size truncates, the
 * smallest entry is returned with its truncated result.
 *
 * Use this when:
 *
 *   - The bounding box is known (width + height)
 *   - You can accept a slightly smaller font for long authored text
 *   - You want compression to kick in only when size reduction is
 *     not enough on its own
 *
 * Typical flow:
 *
 *   1. Try `fontSizePx[0]` (e.g. 15 px). Compute line budget from
 *      `floor(maxHeightPx / (fontSize * lineHeightRatio))`. Call
 *      {@link fitTextToBox} with the caller's `preferredLines` and
 *      the derived `hardMax`. If `truncated === false`, done.
 *   2. Otherwise try `fontSizePx[1]` (e.g. 13 px), etc.
 *   3. If no size avoids truncation, the smallest size's result is
 *      returned (including its truncated lines) — the caller still
 *      gets a scaleX they can apply.
 *
 * Keeps the SSoT principle: every layout that needs "fit Japanese
 * text into a box" consults this one helper instead of each feature
 * re-inventing a font + compression ladder.
 */
export declare function fitTextToBoxWithFontLadder(options: FitTextWithFontLadderOptions): FitTextWithFontLadderResult;
