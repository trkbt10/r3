/**
 * @file layoutMotionArchitecture.spec module.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");
const TRANSFORM_PROPS = /\b(?:x|y|scaleX|scaleY)\s*:/;

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return sourceFiles(path);
    }
    if (!name.endsWith(".ts") || name.endsWith(".spec.ts")) {
      return [];
    }
    return [path];
  });
}

function rootTweenTransformViolations(file: string): readonly string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const violations: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/\btargets:\s*root\b/.test(lines[i] ?? "")) {
      continue;
    }
    const window = lines.slice(i, i + 10);
    if (window.some((line) => TRANSFORM_PROPS.test(line))) {
      violations.push(`${relative(process.cwd(), file)}:${i + 1}`);
    }
  }
  return violations;
}

function sharedRootSetScaleViolations(file: string): readonly string[] {
  if (!/\/(?:r3\/widgets|scenes\/prep)\//.test(file)) {
    return [];
  }
  const lines = readFileSync(file, "utf8").split("\n");
  return lines.flatMap((line, index) => {
    if (/\broot\.setScale\(/.test(line)) {
      return [`${relative(process.cwd(), file)}:${index + 1}`];
    }
    return [];
  });
}

describe("layout motion architecture", () => {
  it("does not animate public root layout transforms", () => {
    const violations = sourceFiles(SRC_ROOT).flatMap((file) => [
      ...rootTweenTransformViolations(file),
      ...sharedRootSetScaleViolations(file),
    ]);

    expect(violations).toEqual([]);
  });
});
