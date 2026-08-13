/**
 * @file FlatPanelRect — stretchable rectangular fill plus optional
 * square-corner stroke, composed from Rect primitives.
 *
 * Use this for large, non-rounded panels and backdrops. It avoids
 * baking a single viewport-sized canvas just to paint a solid fill
 * and 1px border; each child Rect takes the core stretchable-solid
 * path and shares a 1x1 texture by colour/alpha.
 */

import { Container } from "./Container.ts";
import { Rect } from "./Rect.ts";
import type { NodeOptions } from "./Node.ts";
import type { TextureManager } from "./texture-canvas";

export type FlatPanelRectStyle = {
  readonly fill: string;
  readonly fillAlpha?: number;
  readonly strokeColor?: string;
  readonly strokeAlpha?: number;
  readonly strokeWidth?: number;
};

export type FlatPanelRectOptions = NodeOptions & FlatPanelRectStyle & {
  readonly width: number;
  readonly height: number;
  readonly textureManager: TextureManager;
};






/** FlatPanelRect provides the FlatPanelRect API. */
export class FlatPanelRect extends Container {
  private readonly textureManager: TextureManager;
  private _width: number;
  private _height: number;
  private _style: Required<FlatPanelRectStyle>;

  constructor(options: FlatPanelRectOptions) {
    super(options);
    this.textureManager = options.textureManager;
    this._width = Math.max(1, options.width);
    this._height = Math.max(1, options.height);
    this._style = normalizeStyle(options);
    this.rebuild();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  setSize(width: number, height: number): this {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (w === this._width && h === this._height) {
      return this;
    }
    this._width = w;
    this._height = h;
    this.rebuild();
    return this;
  }

  setStyle(style: FlatPanelRectStyle): this {
    this._style = normalizeStyle({ ...this._style, ...style });
    this.rebuild();
    return this;
  }

  private rebuild(): void {
    this.removeAll(true);
    const { fill, fillAlpha, strokeColor, strokeAlpha, strokeWidth } = this._style;
    this.add(new Rect({
      x: 0,
      y: 0,
      width: this._width,
      height: this._height,
      fill,
      fillAlpha,
      originX: 0,
      originY: 0,
      textureManager: this.textureManager,
    }));
    if (!strokeColor || strokeWidth <= 0 || strokeAlpha <= 0) {
      return;
    }
    this.add(edgeRect(0, 0, this._width, strokeWidth, this._style, this.textureManager));
    this.add(edgeRect(
      0,
      this._height - strokeWidth,
      this._width,
      strokeWidth,
      this._style,
      this.textureManager,
    ));
    this.add(edgeRect(0, 0, strokeWidth, this._height, this._style, this.textureManager));
    this.add(edgeRect(
      this._width - strokeWidth,
      0,
      strokeWidth,
      this._height,
      this._style,
      this.textureManager,
    ));
  }
}

function normalizeStyle(style: FlatPanelRectStyle): Required<FlatPanelRectStyle> {
  return {
    fill: style.fill,
    fillAlpha: style.fillAlpha ?? 1,
    strokeColor: style.strokeColor ?? "",
    strokeAlpha: style.strokeAlpha ?? 1,
    strokeWidth: Math.max(0, style.strokeWidth ?? 0),
  };
}

function edgeRect(
  x: number,
  y: number,
  width: number,
  height: number,
  style: Required<FlatPanelRectStyle>,
  textureManager: TextureManager,
): Rect {
  return new Rect({
    x,
    y,
    width,
    height,
    fill: style.strokeColor,
    fillAlpha: style.strokeAlpha,
    originX: 0,
    originY: 0,
    textureManager,
  });
}
