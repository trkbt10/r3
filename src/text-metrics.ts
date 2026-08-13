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
 * Characters that may NOT begin a line (行頭禁則), per the common
 * JIS X 4051 subset: sentence punctuation, middle dots, closing
 * brackets/quotes, prolonged-sound and iteration marks, leaders and
 * dashes (分離禁則 — keeps ……／―― unsplit), and small kana
 * (full-width and half-width) that read as attached to the previous
 * character.
 */
const PROHIBITED_LINE_START = new Set<string>([
  // 句読点
  "、", "。", "，", "．", ",", ".",
  // 中点・コロン類
  "・", "･", "：", ":", "；", ";",
  // 感嘆・疑問
  "？", "?", "！", "!", "‼", "⁇", "⁈", "⁉",
  // 閉じ括弧・閉じ引用符
  "）", ")", "］", "]", "｝", "}", "」", "』", "〕", "〉", "》",
  "〙", "〗", "»", "›", "’", "”", "｠", "〟", "ﾞ", "ﾟ",
  // 長音・波ダッシュ・繰り返し記号
  "ー", "～", "〜", "ゝ", "ゞ", "ヽ", "ヾ", "々", "〻",
  // リーダー・ダッシュ（分離禁則）
  "…", "‥", "—", "―", "–", "‐",
  // 小書き仮名（全角）
  "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "っ", "ゃ", "ゅ", "ょ", "ゎ", "ゕ", "ゖ",
  "ァ", "ィ", "ゥ", "ェ", "ォ", "ッ", "ャ", "ュ", "ョ", "ヮ", "ヵ", "ヶ",
  // 小書き仮名・長音（半角）
  "ｧ", "ｨ", "ｩ", "ｪ", "ｫ", "ｬ", "ｭ", "ｮ", "ｯ", "ｰ",
]);

/**
 * Characters that may NOT end a line (行末禁則): opening brackets and
 * opening quotes. They are pushed down to start the next line.
 */
const PROHIBITED_LINE_END = new Set<string>([
  "（", "(", "［", "[", "｛", "{", "「", "『", "〔", "〈", "《",
  "〘", "〖", "«", "‹", "‘", "“", "｟", "〝",
]);

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
export function wrapText(text: string, options: WrapOptions): WrappedLine[] {
  const { maxWidth, measure } = options;
  if (text.length === 0) {
    return [{ text: "", width: 0 }];
  }
  const out: WrappedLine[] = [];
  const hardLines = text.split("\n");
  for (const hard of hardLines) {
    const wrapped = wrapHardLine(hard, maxWidth, measure);
    for (const line of wrapped) {
      out.push(line);
    }
  }
  return out;
}

/** Builds a {@link WrappedLine} from a buffer of codepoints. */
function toWrappedLine(parts: readonly string[], measure: MeasureFn): WrappedLine {
  const joined = parts.join("");
  return { text: joined, width: measure(joined) };
}

/**
 * Searches backward from `current.length` for the last position where
 * the break is legal on both sides — the new line's head (at
 * `current[breakAt]`, or `pendingChar` when `breakAt` is exactly
 * `current.length`) is not 行頭禁則 and the old line's tail (at
 * `current[breakAt - 1]`) is not 行末禁則. Returns `0` when no legal
 * break exists anywhere in `current` (ぶら下げ fallback territory).
 */
function findPushOutBreak(current: readonly string[], pendingChar: string): number {
  const isLegalBreak = (breakAt: number): boolean => {
    const head = breakAt < current.length ? current[breakAt] : pendingChar;
    const tail = current[breakAt - 1];
    return (
      head !== undefined &&
      tail !== undefined &&
      !PROHIBITED_LINE_START.has(head) &&
      !PROHIBITED_LINE_END.has(tail)
    );
  };
  const candidates = Array.from({ length: current.length }, (_, k) => current.length - k);
  return candidates.find(isLegalBreak) ?? 0;
}

/**
 * Consumes every 行頭禁則 codepoint immediately following
 * `codepoints[fromIndex]` (inclusive) so a ぶら下げ line's trailing
 * prohibited run absorbs its whole run in one step. Returns the
 * consumed codepoints and the index immediately after them.
 */
function consumeProhibitedRun(
  codepoints: readonly string[],
  fromIndex: number,
): { readonly consumed: readonly string[]; readonly nextIndex: number } {
  const first = codepoints[fromIndex];
  if (first === undefined) {
    return { consumed: [], nextIndex: fromIndex };
  }
  const trailingCount = (() => {
    const rest = codepoints.slice(fromIndex + 1);
    const firstNonProhibited = rest.findIndex((c) => !PROHIBITED_LINE_START.has(c));
    return firstNonProhibited === -1 ? rest.length : firstNonProhibited;
  })();
  return {
    consumed: codepoints.slice(fromIndex, fromIndex + 1 + trailingCount),
    nextIndex: fromIndex + 1 + trailingCount,
  };
}

/**
 * Greedily accumulates codepoints from `index` onward into wrapped
 * lines, applying 追い出し (push-out) on overflow and ぶら下げ
 * (hang) when no legal push-out break exists. Recurses instead of
 * looping with mutable cursors so the whole line-wrap walk stays
 * expression-based; each call advances `index` (or exhausts
 * `codepoints`), so the recursion is bounded by the input length.
 */
function wrapCodepoints(
  codepoints: readonly string[],
  index: number,
  current: readonly string[],
  maxWidth: number,
  measure: MeasureFn,
  lines: readonly WrappedLine[],
): readonly WrappedLine[] {
  if (index >= codepoints.length) {
    return current.length > 0 ? [...lines, toWrappedLine(current, measure)] : lines;
  }
  const ch = codepoints[index];
  if (ch === undefined) {
    return wrapCodepoints(codepoints, index + 1, current, maxWidth, measure, lines);
  }
  const grown = [...current, ch];
  if (measure(grown.join("")) <= maxWidth) {
    return wrapCodepoints(codepoints, index + 1, grown, maxWidth, measure, lines);
  }
  // Overflow. Edge case: a single codepoint that cannot fit no matter
  // what — emit it alone (it overflows).
  if (current.length === 0) {
    return wrapCodepoints(codepoints, index + 1, [], maxWidth, measure, [
      ...lines,
      toWrappedLine(grown, measure),
    ]);
  }
  const breakAt = findPushOutBreak(current, ch);
  if (breakAt === 0) {
    // No legal break inside the line (e.g. "、、、、…"): hang the
    // prohibited run on this line past maxWidth (ぶら下げ). Consume
    // `ch` and every directly following 行頭禁則 codepoint so the
    // next line starts legally; deterministic and loop-free.
    const run = consumeProhibitedRun(codepoints, index);
    return wrapCodepoints(codepoints, run.nextIndex, [], maxWidth, measure, [
      ...lines,
      toWrappedLine([...current, ...run.consumed], measure),
    ]);
  }
  // Pushed-out characters open the next line; `ch` itself is NOT
  // consumed here — the recursion retries it against the shorter
  // buffer.
  return wrapCodepoints(codepoints, index, current.slice(breakAt), maxWidth, measure, [
    ...lines,
    toWrappedLine(current.slice(0, breakAt), measure),
  ]);
}

function wrapHardLine(text: string, maxWidth: number, measure: MeasureFn): WrappedLine[] {
  if (text.length === 0) {
    return [{ text: "", width: 0 }];
  }
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    // No wrapping requested — single line, even if it overflows the
    // (zero / non-finite) constraint.
    return [{ text, width: measure(text) }];
  }
  const codepoints = Array.from(text);
  const lines = wrapCodepoints(codepoints, 0, [], maxWidth, measure, []);

  return applyJapaneseOrphanRule([...lines], measure);
}

function applyJapaneseOrphanRule(
  lines: WrappedLine[],
  measure: MeasureFn,
): WrappedLine[] {
  if (lines.length < 2) {
    return lines;
  }
  const out: WrappedLine[] = lines.map((l) => ({ text: l.text, width: l.width }));
  for (let i = 1; i < out.length; i += 1) {
    const line = out[i];
    const prev = out[i - 1];
    if (!line || !prev) {
      continue;
    }
    const lineChars = Array.from(line.text);
    const prevChars = Array.from(prev.text);
    if (
      lineChars.length !== 1 ||
      prevChars.length <= 1 ||
      !isJapaneseIdeograph(lineChars[0] ?? "") ||
      !isJapaneseIdeograph(prevChars[prevChars.length - 1] ?? "")
    ) {
      continue;
    }
    // Don't let the borrow manufacture a 行末禁則 violation (e.g.
    // "…は「漢" + orphan "字" would leave 「 at the line end).
    const exposedTail = prevChars[prevChars.length - 2];
    if (exposedTail !== undefined && PROHIBITED_LINE_END.has(exposedTail)) {
      continue;
    }
    const borrowed = prevChars.pop();
    if (!borrowed) {
      continue;
    }
    const nextPrevText = prevChars.join("");
    const nextLineText = borrowed + line.text;
    out[i - 1] = { text: nextPrevText, width: measure(nextPrevText) };
    out[i] = { text: nextLineText, width: measure(nextLineText) };
  }
  return out.filter((line) => line.text.length > 0);
}

function isJapaneseIdeograph(ch: string): boolean {
  return /\p{Script=Han}/u.test(ch);
}

/* ── Canvas-backed measure helpers (used by Text in production) ───── */

/** Concrete text-style fields used to build a `font:` shorthand. */
export type FontStyleSpec = {
  readonly family: string;
  readonly size: number;
  readonly weight?: "normal" | "bold" | number;
  readonly style?: "normal" | "italic";
};

/** Builds a CSS `font:` shorthand from the typed pieces. */
export function buildFontShorthand(spec: FontStyleSpec): string {
  const style = spec.style ?? "normal";
  const weight = String(spec.weight ?? "normal");
  return `${style} ${weight} ${String(spec.size)}px ${spec.family}`;
}

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
export function snapshotMetrics(
  metrics: TextMetrics,
  fontSize: number,
): CanvasMetricSnapshot {
  const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;
  return {
    width: metrics.width,
    ascent,
    descent,
  };
}

// ===========================================================================
// Fit-to-box compression (Japanese text-box SSoT)
// ===========================================================================

/**
 * Default compression ladder used by {@link fitTextToBox}. Picked so
 * each step is a noticeable-but-subtle change: at 0.95 the run reads
 * as normal Japanese, at 0.85–0.80 it reads as slightly tall/narrow.
 */
export const FIT_SCALE_CANDIDATES: readonly number[] = [1, 0.95, 0.9, 0.85, 0.8];

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
export function fitTextToBox(options: FitTextToBoxOptions): FitTextToBoxResult {
  const {
    text,
    measure,
    maxWidthPx,
    preferredLines,
    hardMax,
    candidates = FIT_SCALE_CANDIDATES,
  } = options;
  const minScale = candidates[candidates.length - 1] ?? 1;
  const effective = Math.min(Math.max(1, preferredLines), Math.max(1, hardMax));

  const tryWrap = (scaleX: number): readonly WrappedLine[] => {
    return wrapText(text, {
      maxWidth: maxWidthPx / scaleX,
      measure,
    });
  };

  for (const scaleX of candidates) {
    const lines = tryWrap(scaleX);
    if (lines.length <= effective) {
      return { lines, scaleX, truncated: false };
    }
  }
  if (hardMax > effective) {
    for (const scaleX of candidates) {
      const lines = tryWrap(scaleX);
      if (lines.length <= hardMax) {
        return { lines, scaleX, truncated: false };
      }
    }
  }
  const lines = tryWrap(minScale).slice(0, hardMax);
  return { lines, scaleX: minScale, truncated: true };
}

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
export function fitTextToBoxWithFontLadder(
  options: FitTextWithFontLadderOptions,
): FitTextWithFontLadderResult {
  const {
    text,
    makeMeasure,
    maxWidthPx,
    maxHeightPx,
    preferredLines,
    fontSizePx,
    lineHeightRatio,
    scaleCandidates,
  } = options;
  if (fontSizePx.length === 0) {
    throw new Error("fitTextToBoxWithFontLadder: fontSizePx must not be empty");
  }

  const results = fontSizePx.map((size) => {
    const hardMax = Math.max(1, Math.floor(maxHeightPx / (size * lineHeightRatio)));
    const fit = fitTextToBox({
      text,
      measure: makeMeasure(size),
      maxWidthPx,
      preferredLines,
      hardMax,
      candidates: scaleCandidates,
    });
    const result: FitTextWithFontLadderResult = {
      ...fit,
      fontSizePx: size,
    };
    return result;
  });
  const firstFullFit = results.find((result) => !result.truncated);
  if (firstFullFit) {
    return firstFullFit;
  }
  // Every size truncated — return the smallest, which packs the most
  // text into the available box even if the tail is cut.
  return results.at(-1) ?? {
    lines: [],
    scaleX: 1,
    truncated: true,
    fontSizePx: fontSizePx[fontSizePx.length - 1] ?? 10,
  };
}
