/**
 * @file Select — compact r3 dropdown control.
 *
 * Native DOM select is unavailable inside the r3 canvas tree, but dense
 * overlay screens still need a low-emphasis single-choice control.
 */

import { Container } from "../Container.ts";
import { Rect } from "../Rect.ts";
import { Text } from "../Text.ts";
import type { Stage } from "../Stage.ts";
import type { TextureManager } from "../texture-canvas";
import { playR3Sfx } from "../audio.ts";
import { COLOR, FONT } from "../theme";
import { Scene, type WebGLRenderer } from "three";

export type R3SelectOption<T extends string> = {
  readonly value: T;
  readonly label: string;
};

export type R3SelectHandle<T extends string> = {
  readonly node: Container;
  readonly value: T;
  readonly setRect: (rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }) => void;
  readonly setValue: (value: T) => void;
  readonly close: () => void;
  readonly destroy: () => void;
};






/** createR3Select provides the createR3Select API. */
export function createR3Select<T extends string>(options: {
  readonly stage: Stage;
  readonly parent: Container;
  readonly textureManager: TextureManager;
  readonly value: T;
  readonly options: readonly R3SelectOption<T>[];
  readonly onChange: (value: T) => void;
  readonly name?: string;
}): R3SelectHandle<T> {
  const root = new Container({ name: options.name ?? "r3:select" });
  options.parent.add(root);
  const state = {
    value: options.value,
    rect: { x: 0, y: 0, width: 120, height: 34 },
    open: false,
    popup: null as Container | null,
    overlayPopup: null as Container | null,
    overlayScene: null as Scene | null,
    overlayDisposer: null as (() => void) | null,
  };

  const bg = new Rect({
    x: 0,
    y: 0,
    width: state.rect.width,
    height: state.rect.height,
    fill: COLOR.INK_BUTTON,
    fillAlpha: 0.9,
    strokeColor: COLOR.GOLD,
    strokeAlpha: 0.5,
    strokeWidth: 1,
    cornerRadius: 7,
    originX: 0,
    originY: 0,
    interactive: true,
    textureManager: options.textureManager,
  });
  root.add(bg);

  const label = new Text({
    x: 10,
    y: state.rect.height / 2,
    text: labelFor(state.value),
    font: { family: FONT.MINCHO, size: 13, weight: "bold" },
    color: COLOR.CREAM_TEXT,
    originX: 0,
    originY: 0.5,
    maxWidth: state.rect.width - 34,
    maxLines: 1,
    textureManager: options.textureManager,
  });
  root.add(label);

  const arrow = new Text({
    x: state.rect.width - 16,
    y: state.rect.height / 2,
    text: "▼",
    font: { family: FONT.MINCHO, size: 11, weight: "bold" },
    color: COLOR.GOLD,
    originX: 0.5,
    originY: 0.5,
    textureManager: options.textureManager,
  });
  root.add(arrow);

  function labelFor(value: T): string {
    return options.options.find((entry) => entry.value === value)?.label ?? "";
  }

  function repaint(): void {
    bg.setPosition(state.rect.x, state.rect.y);
    bg.setSize(state.rect.width, state.rect.height);
    label.setPosition(state.rect.x + 10, state.rect.y + state.rect.height / 2);
    label.setMaxWidth(Math.max(1, state.rect.width - 34));
    label.setText(labelFor(state.value));
    arrow.setPosition(state.rect.x + state.rect.width - 16, state.rect.y + state.rect.height / 2);
  }

  function close(): void {
    state.popup?.destroy();
    state.popup = null;
    state.overlayDisposer?.();
    state.overlayDisposer = null;
    state.overlayPopup?.destroy();
    state.overlayPopup = null;
    state.overlayScene?.clear();
    state.overlayScene = null;
    state.open = false;
  }

  function open(): void {
    close();
    state.open = true;
    const popup = new Container({ name: "r3:select-popup" });
    popup.setDepth(200);
    options.parent.add(popup);
    const overlayScene = new Scene();
    const overlayPopup = new Container({ name: "r3:select-popup:overlay" });
    overlayScene.add(overlayPopup.obj3d);
    state.overlayScene = overlayScene;
    state.overlayPopup = overlayPopup;
    state.overlayDisposer = options.stage.registerOverlayLayerFn((renderer: WebGLRenderer) => {
      overlayPopup.composeWorldState(1, true);
      overlayPopup.composeRenderOrder(0, 100000);
      renderer.clearDepth();
      renderer.render(overlayScene, options.stage.camera);
    });
    const rowH = state.rect.height;
    const popupH = rowH * options.options.length;
    addPopupPlate(popup, popupH, true);
    addPopupPlate(overlayPopup, popupH, false);
    options.options.forEach((entry, index) => {
      const y = state.rect.y + state.rect.height + 4 + rowH * index;
      const active = entry.value === state.value;
      const hit = new Rect({
        x: state.rect.x,
        y,
        width: state.rect.width,
        height: rowH,
        fill: active ? COLOR.GOLD : COLOR.BLACK,
        fillAlpha: active ? 0.2 : 0,
        originX: 0,
        originY: 0,
        interactive: true,
        textureManager: options.textureManager,
      });
      hit.on("pointerup", () => {
        playR3Sfx("title-button-click");
        handle.setValue(entry.value);
        close();
        options.onChange(entry.value);
      });
      popup.add(hit);
      addPopupLabel(popup, entry.label, y, active);
      addPopupLabel(overlayPopup, entry.label, y, active);
    });
    state.popup = popup;
  }

  function addPopupPlate(parent: Container, height: number, interactive: boolean): void {
    parent.add(new Rect({
      x: state.rect.x,
      y: state.rect.y + state.rect.height + 4,
      width: state.rect.width,
      height,
      fill: COLOR.INK_PANEL,
      fillAlpha: 0.98,
      strokeColor: COLOR.GOLD,
      strokeAlpha: 0.72,
      strokeWidth: 1,
      cornerRadius: 7,
      originX: 0,
      originY: 0,
      interactive,
      textureManager: options.textureManager,
    }));
  }

  function addPopupLabel(parent: Container, text: string, y: number, active: boolean): void {
    parent.add(new Text({
      x: state.rect.x + 10,
      y: y + state.rect.height / 2,
      text,
      font: { family: FONT.MINCHO, size: 13, weight: active ? "bold" : "normal" },
      color: active ? COLOR.GOLD : COLOR.CREAM_TEXT,
      originX: 0,
      originY: 0.5,
      maxWidth: Math.max(1, state.rect.width - 20),
      maxLines: 1,
      textureManager: options.textureManager,
    }));
  }

  bg.on("pointerup", () => {
    playR3Sfx("title-button-click");
    if (state.open) {
      close();
    } else {
      open();
    }
  });

  const handle: R3SelectHandle<T> = {
    node: root,
    get value(): T {
      return state.value;
    },
    setRect(rect): void {
      state.rect = rect;
      repaint();
      if (state.open) {
        open();
      }
    },
    setValue(value): void {
      state.value = value;
      repaint();
    },
    close,
    destroy(): void {
      close();
      root.destroy();
    },
  };
  repaint();
  return handle;
}
