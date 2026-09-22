import { Container } from '../Container.ts';
import { TextureManager } from '../texture-canvas';
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
export declare function isR3TextInputElement(element: Element | null): boolean;
/** Creates a visible r3 text input whose editing state is owned by a hidden native input. */
export declare function createR3TextInput(options: R3TextInputOptions): R3TextInputHandle;
