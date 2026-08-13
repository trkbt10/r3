/**
 * @vitest-environment happy-dom
 *
 * @file Plaque — pluggable panel-effect framework coverage.
 *
 * The refactor took Plaque from "owns a single hard-coded drop
 * shadow" to "owns a chrome panel plus a list of pluggable effects
 * each attached to a back or front layer". These tests lock down the
 * contract the framework promises:
 *
 *   1. A plaque with no effects creates no decoration layers and
 *      leaves the host with just the chrome.
 *   2. A plaque with N effects creates back + front layer containers
 *      and mounts each effect into whichever layer it picked. Paint
 *      order within the host is `back → chrome → front`.
 *   3. `setRect` fans out to every effect handle with the new rect
 *      (so decorations track resize without bespoke wiring).
 *   4. `destroy` tears down every mounted effect exactly once before
 *      the chrome is destroyed.
 *   5. The legacy `shadow: true / false / {...}` options are sugar
 *      for prepending a {@link dropShadow} effect — existing HUD
 *      widgets that still pass `shadow` keep working unchanged.
 *
 * The tests use *synthetic* effects (counter-instrumented factories)
 * rather than the real dropShadow / innerHighlight. That way the
 * framework contract is tested independently of any particular
 * effect's rendering details — a regression in dropShadow's paint
 * code shouldn't make these tests flicker, and these tests shouldn't
 * silently pass when the framework is broken but happens to wire
 * dropShadow correctly.
 */

import { Container } from "../Container.ts";
import { Stage } from "../Stage.ts";
import { defaultTextureManager } from "../texture-canvas";
import { createR3Plaque } from "./Plaque.ts";
import type {
  UiPanelEffect,
  UiPanelEffectHandle,
  UiPanelEffectRect,
} from "./panel-effects";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

type Layer = "back" | "front";

type EffectSpy = {
  readonly effect: UiPanelEffect;
  readonly mountCalls: number;
  readonly rects: readonly UiPanelEffectRect[];
  readonly destroyCalls: number;
  readonly marker: Container;
};

/**
 * Builds a spy effect that records every mount / setRect / destroy
 * call. Attaches a uniquely-named marker Container to whichever
 * layer the test asks for so we can identify effect nodes in the
 * host child list without poking at internal refs.
 */
function makeSpy(layer: Layer, name: string): EffectSpy {
  const state = {
    mountCalls: 0,
    rects: [] as UiPanelEffectRect[],
    destroyCalls: 0,
  };
  const marker = new Container({ name });
  const effect: UiPanelEffect = (ctx, initialRect) => {
    state.mountCalls += 1;
    state.rects.push(initialRect);
    ctx.hosts[layer].add(marker);
    const handle: UiPanelEffectHandle = {
      setRect(rect): void {
        state.rects.push(rect);
      },
      destroy(): void {
        state.destroyCalls += 1;
      },
    };
    return handle;
  };
  return {
    effect,
    get mountCalls(): number {
      return state.mountCalls;
    },
    get rects(): readonly UiPanelEffectRect[] {
      return state.rects.slice();
    },
    get destroyCalls(): number {
      return state.destroyCalls;
    },
    marker,
  };
}

describe("createR3Plaque (pluggable effects)", () => {
  it("adds only the chrome panel when no effects are supplied", () => {
    const stage = makeStage();
    const host = new Container({ name: "host" });
    stage.add(host);

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      x: 10,
      y: 20,
      width: 200,
      height: 80,
      shadow: false,
    });

    expect(host.children).toHaveLength(1);
    expect(host.children[0]).toBe(plaque.panel.node);
  });

  it("sandwiches back + chrome + front layers in paint order", () => {
    const stage = makeStage();
    const host = new Container({ name: "host" });
    stage.add(host);

    const back = makeSpy("back", "spy:back");
    const front = makeSpy("front", "spy:front");

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      width: 100,
      height: 40,
      shadow: false,
      effects: [back.effect, front.effect],
    });

    // Expected host children: [backLayer, chrome, frontLayer].
    expect(host.children).toHaveLength(3);
    expect(host.children[1]).toBe(plaque.panel.node);

    // First child is the back layer and holds the back marker.
    const backLayer = host.children[0];
    expect(backLayer).toBeInstanceOf(Container);
    expect((backLayer as Container).children).toContain(back.marker);

    // Last child is the front layer and holds the front marker.
    const frontLayer = host.children[2];
    expect(frontLayer).toBeInstanceOf(Container);
    expect((frontLayer as Container).children).toContain(front.marker);
  });

  it("forwards every setRect to every mounted effect", () => {
    const host = new Container({ name: "host" });
    makeStage().add(host);
    const back = makeSpy("back", "spy:back");
    const front = makeSpy("front", "spy:front");

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      shadow: false,
      effects: [back.effect, front.effect],
    });
    plaque.setRect(5, 7, 200, 60);
    plaque.setRect(5, 7, 300, 90);

    // Each spy records 1 initial + 2 setRect => 3 rects.
    expect(back.rects).toHaveLength(3);
    expect(front.rects).toHaveLength(3);
    expect(back.rects[2]).toEqual({ x: 5, y: 7, width: 300, height: 90 });
    expect(front.rects[2]).toEqual({ x: 5, y: 7, width: 300, height: 90 });
  });

  it("destroys every mounted effect exactly once on teardown", () => {
    const host = new Container({ name: "host" });
    makeStage().add(host);
    const back = makeSpy("back", "spy:back");
    const front = makeSpy("front", "spy:front");

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      width: 100,
      height: 40,
      shadow: false,
      effects: [back.effect, front.effect],
    });

    expect(back.destroyCalls).toBe(0);
    expect(front.destroyCalls).toBe(0);
    plaque.destroy();
    expect(back.destroyCalls).toBe(1);
    expect(front.destroyCalls).toBe(1);
  });

  it("legacy shadow:true prepends a drop shadow ahead of explicit effects", () => {
    const host = new Container({ name: "host" });
    makeStage().add(host);
    const front = makeSpy("front", "spy:front");

    createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      width: 100,
      height: 40,
      shadow: true,
      effects: [front.effect],
    });

    // Layer layout is back + chrome + front; the legacy shadow picked
    // the back layer, and our front spy picked the front layer, so
    // the host should have all three slots populated.
    expect(host.children).toHaveLength(3);
    const backLayer = host.children[0] as Container;
    expect(backLayer.children.length).toBe(1); // legacy dropShadow Graphics
    const frontLayer = host.children[2] as Container;
    expect(frontLayer.children).toContain(front.marker);
  });

  it("tick fans out to effects with tick(); effects without tick are skipped", () => {
    const host = new Container({ name: "host" });
    makeStage().add(host);

    const tickCalls: number[] = [];
    const tickingEffect: UiPanelEffect = (ctx) => {
      ctx.hosts.front.add(new Container({ name: "tick-effect" }));
      return {
        setRect: () => undefined,
        tick(dtSeconds): boolean {
          tickCalls.push(dtSeconds);
          return false;
        },
        destroy: () => undefined,
      };
    };
    const staticSpy = makeSpy("front", "static-effect");

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      width: 100,
      height: 40,
      shadow: false,
      effects: [tickingEffect, staticSpy.effect],
    });

    plaque.tick(1 / 60);
    plaque.tick(1 / 30);
    expect(tickCalls).toEqual([1 / 60, 1 / 30]);
    // staticSpy has no tick method; no crash + no tick recorded on it.
    expect(staticSpy.rects).toHaveLength(1); // just the initial mount rect
  });

  it("tick removes effects that signal completion", () => {
    const host = new Container({ name: "host" });
    makeStage().add(host);

    const state = { ticks: 0, destroyed: false };
    const selfTerminating: UiPanelEffect = (ctx) => {
      ctx.hosts.front.add(new Container({ name: "one-shot" }));
      return {
        setRect: () => undefined,
        tick(): boolean {
          state.ticks += 1;
          return state.ticks >= 2; // finish on second tick
        },
        destroy(): void {
          state.destroyed = true;
        },
      };
    };

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      width: 100,
      height: 40,
      shadow: false,
      effects: [selfTerminating],
    });

    plaque.tick(0.016);
    expect(state.destroyed).toBe(false);
    plaque.tick(0.016); // this tick returns true, triggers destroy + splice
    expect(state.destroyed).toBe(true);
    // A third tick must be safe (no crash) and hit no effects.
    plaque.tick(0.016);
    expect(state.ticks).toBe(2);
  });

  it("legacy shadow:false omits the default drop shadow", () => {
    const host = new Container({ name: "host" });
    makeStage().add(host);
    const front = makeSpy("front", "spy:front");

    const plaque = createR3Plaque({
      host,
      textureManager: defaultTextureManager,
      width: 100,
      height: 40,
      shadow: false,
      effects: [front.effect],
    });

    // Back layer exists because we have effects, but it has no
    // children (nothing picked the back layer). Chrome + front
    // layer populate the other two slots.
    expect(host.children).toHaveLength(3);
    const backLayer = host.children[0] as Container;
    expect(backLayer.children.length).toBe(0);
    expect(host.children[1]).toBe(plaque.panel.node);
  });
});
