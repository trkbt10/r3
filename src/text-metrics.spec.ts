/**
 * @file 禁則処理 contract for the shared line wrapper: prohibited
 * line-start characters are pushed out (never lead a line), opening
 * brackets never trail a line, leader/dash runs stay unsplit,
 * pathological punctuation runs hang deterministically, and every
 * wrap concatenates back to its input (the TextInput caret math
 * depends on that invariant).
 */

import { wrapText, type WrappedLine } from "./text-metrics.ts";

/** Synthetic measure: every codepoint is 1 unit wide. */
function measure(text: string): number {
  return Array.from(text).length;
}

function wrap(text: string, maxWidth: number): readonly WrappedLine[] {
  return wrapText(text, { maxWidth, measure });
}

function texts(lines: readonly WrappedLine[]): string[] {
  return lines.map((l) => l.text);
}

const LINE_START_SAMPLES = ["、", "。", "」", "）", "ー", "っ", "ョ", "…", "？", "！", "・"];
const LINE_END_SAMPLES = ["「", "（", "『", "〔"];

describe("wrapText 禁則処理", () => {
  it("plain greedy wrap splits at maxWidth", () => {
    expect(texts(wrap("あいうえおかきくけこ", 4))).toEqual(["あいうえ", "おかきく", "けこ"]);
  });

  it("行頭禁則: punctuation is pushed out, not left at a line head", () => {
    const lines = wrap("こんにちは、世界。", 5);
    expect(texts(lines)).toEqual(["こんにち", "は、世界。"]);
  });

  it("行頭禁則: no prohibited character ever leads a wrapped line", () => {
    const text = "ああ、いい。うう」ええ）おおーかかっくくョけけ…ここ？さfurther！しし・すす";
    for (const width of [2, 3, 4, 5, 6, 7]) {
      for (const line of wrap(text, width).slice(1)) {
        const head = Array.from(line.text)[0] ?? "";
        expect(LINE_START_SAMPLES).not.toContain(head);
      }
    }
  });

  it("行末禁則: opening brackets never trail a line", () => {
    const lines = wrap("彼は「こんにちは」と言った", 3);
    for (const line of lines) {
      const tail = Array.from(line.text).at(-1) ?? "";
      expect(LINE_END_SAMPLES).not.toContain(tail);
    }
    // The bracket opens the line that holds its content.
    expect(texts(lines)).toContain("「こん");
  });

  it("分離禁則: leader runs (……) are not split across lines", () => {
    const lines = wrap("それは……そうだ", 4);
    for (const line of lines.slice(1)) {
      expect(Array.from(line.text)[0]).not.toBe("…");
    }
    const joined = texts(lines).join("\n");
    expect(joined).toContain("……");
  });

  it("分離禁則: dash runs (――) are not split across lines", () => {
    const lines = wrap("審判――それが役目", 3);
    for (const line of lines.slice(1)) {
      expect(Array.from(line.text)[0]).not.toBe("―");
    }
  });

  it("ぶら下げ fallback: a pure punctuation run hangs without looping", () => {
    const lines = wrap("あ、、、、、い", 2);
    expect(texts(lines)).toEqual(["あ、、、、、", "い"]);
  });

  it("ぶら下げ fallback: all-opening-bracket line stays deterministic", () => {
    const lines = wrap("「「「「あ", 3);
    // No legal break inside the bracket run — it hangs with the
    // first legal head rather than infinite-looping.
    expect(texts(lines).join("")).toBe("「「「「あ");
  });

  it("hard newlines always break", () => {
    expect(texts(wrap("ああ\nいい", 10))).toEqual(["ああ", "いい"]);
  });

  it("empty input yields a single empty line", () => {
    expect(texts(wrap("", 10))).toEqual([""]);
  });

  it("orphan rule: a lone trailing ideograph borrows a companion", () => {
    expect(texts(wrap("漢字漢字漢", 4))).toEqual(["漢字漢", "字漢"]);
  });

  it("orphan rule: the borrow never exposes an opening bracket at a line end", () => {
    const lines = wrap("です「漢字", 4);
    for (const line of lines) {
      const tail = Array.from(line.text).at(-1) ?? "";
      expect(LINE_END_SAMPLES).not.toContain(tail);
    }
  });

  it("invariant: wrapped lines concatenate back to the input", () => {
    const samples = [
      "まだ家族が待っているから、どうか助けてほしい。理由なら何度でも話す。",
      "彼は「待ってくれ……」と言った――それだけだった。",
      "ああ、、、、、それでも！？",
      "（括弧）と『引用』と〔注記〕が、ぜんぶ混ざった文章です。",
      "English words mixed with 日本語、そして punctuation. OK?",
    ];
    for (const sample of samples) {
      for (const width of [2, 3, 5, 8, 13, 21]) {
        expect(texts(wrap(sample, width)).join("")).toBe(sample.replaceAll("\n", ""));
      }
    }
  });
});
