import { Container } from '../Container.ts';
import { Stage } from '../Stage.ts';
import { TextureManager } from '../texture-canvas';
export type R3SelectOption<T extends string> = {
    readonly value: T;
    readonly label: string;
};
export type R3SelectHandle<T extends string> = {
    readonly node: Container;
    readonly value: T;
    readonly setRect: (rect: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
    }) => void;
    readonly setValue: (value: T) => void;
    readonly close: () => void;
    readonly destroy: () => void;
};
/** createR3Select provides the createR3Select API. */
export declare function createR3Select<T extends string>(options: {
    readonly stage: Stage;
    readonly parent: Container;
    readonly textureManager: TextureManager;
    readonly value: T;
    readonly options: readonly R3SelectOption<T>[];
    readonly onChange: (value: T) => void;
    readonly name?: string;
}): R3SelectHandle<T>;
