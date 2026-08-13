/**
 * @vitest-environment happy-dom
 *
 * @file TextInput — native input focus contract.
 */

import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3TextInput, isR3TextInputElement } from "./TextInput.ts";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 390, height: 844 },
    textureManager: defaultTextureManager,
  });
}

describe("createR3TextInput", () => {
  it("marks its native input so scene layout code can preserve focus during viewport resizes", () => {
    const stage = makeStage();
    const input = createR3TextInput({
      x: 180,
      y: 120,
      width: 260,
      height: 56,
      value: "",
      placeholder: "name",
      textureManager: defaultTextureManager,
    });
    stage.add(input.node);

    input.focus();
    const active = document.activeElement;

    expect(isR3TextInputElement(active)).toBe(true);
    expect(active).toBe(document.querySelector("input[data-r3-text-input='true']"));

    input.destroy();
  });

  it("keeps accepting text after the host stage changes screen size", () => {
    const stage = makeStage();
    const input = createR3TextInput({
      x: 180,
      y: 120,
      width: 260,
      height: 56,
      value: "",
      placeholder: "name",
      textureManager: defaultTextureManager,
    });
    stage.add(input.node);

    input.focus();
    input.setValue("ios");
    stage.setScreen({ width: 390, height: 640 });
    input.setValue(`${input.value()}-ok`);

    expect(isR3TextInputElement(document.activeElement)).toBe(true);
    expect(input.value()).toBe("ios-ok");

    input.destroy();
  });
});
