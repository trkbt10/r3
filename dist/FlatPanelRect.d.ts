import { Container } from './Container.ts';
import { NodeOptions } from './Node.ts';
import { TextureManager } from './texture-canvas';
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
export declare class FlatPanelRect extends Container {
    private readonly textureManager;
    private _width;
    private _height;
    private _style;
    constructor(options: FlatPanelRectOptions);
    get width(): number;
    get height(): number;
    setSize(width: number, height: number): this;
    setStyle(style: FlatPanelRectStyle): this;
    private rebuild;
}
