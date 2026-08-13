/**
 * @file SceneManager — start / stop / replace + active-scene bookkeeping.
 *
 * Uses a tiny `TestScene` that records lifecycle events into an
 * external array so assertions stay close to the user-visible
 * sequence (what got entered, in what order, with what payload).
 */

import { Stage } from "./Stage.ts";
import { Scene, type SceneData } from "./Scene.ts";
import { SceneManager } from "./SceneManager.ts";
import { defaultTextureManager } from "./texture-canvas";

type Event =
  | { kind: "enter"; key: string; payload: SceneData }
  | { kind: "update"; key: string; dt: number }
  | { kind: "exit"; key: string };

class TestScene extends Scene {
  private readonly events: Event[];
  constructor(stage: Stage, key: string, events: Event[]) {
    super(stage, key);
    this.events = events;
  }
  protected override onEnter(payload: SceneData): void {
    this.events.push({ kind: "enter", key: this.name, payload });
  }
  override update(dt: number): void {
    this.events.push({ kind: "update", key: this.name, dt });
  }
  protected override onExit(): void {
    this.events.push({ kind: "exit", key: this.name });
  }
}

function makeStage(): Stage {
  return new Stage({
    screen: { width: 800, height: 600 },
    textureManager: defaultTextureManager,
  });
}

/**
 * Renders a recorded lifecycle event as a compact string the
 * "restart" assertion can read top-to-bottom. Enter records carry
 * the per-payload phase tag; other events just carry the key.
 */
function formatEvent(e: Event): string {
  if (e.kind !== "enter") {
    return `${e.kind}:${e.key}`;
  }
  const payload = e.payload as { phase?: number };
  return `enter:${e.key}:${String(payload.phase)}`;
}

describe("SceneManager", () => {
  it("constructs a scene on first start and reuses it on second start", () => {
    const stage = makeStage();
    const events: Event[] = [];
    const factories: number[] = [];
    const mgr = new SceneManager(stage);
    mgr.register({
      key: "demo",
      factory: (s, k) => {
        factories.push(1);
        return new TestScene(s, k, events);
      },
    });
    mgr.start("demo");
    mgr.stop("demo");
    mgr.start("demo");
    expect(factories.length).toBe(1);
    const enters = events.filter((e) => e.kind === "enter");
    expect(enters).toHaveLength(2);
  });

  it("forces a fresh instance when recreate: true is passed", () => {
    const stage = makeStage();
    const events: Event[] = [];
    const factories: number[] = [];
    const mgr = new SceneManager(stage);
    mgr.register({
      key: "demo",
      factory: (s, k) => {
        factories.push(1);
        return new TestScene(s, k, events);
      },
    });
    mgr.start("demo");
    mgr.start("demo", undefined, { recreate: true });
    expect(factories.length).toBe(2);
  });

  it("replace: true exits every prior active scene", () => {
    const stage = makeStage();
    const events: Event[] = [];
    const mgr = new SceneManager(stage);
    mgr.register({ key: "a", factory: (s, k) => new TestScene(s, k, events) });
    mgr.register({ key: "b", factory: (s, k) => new TestScene(s, k, events) });
    mgr.start("a");
    mgr.start("b", undefined, { replace: true });
    expect(events.map((e) => `${e.kind}:${e.key}`)).toEqual([
      "enter:a",
      "exit:a",
      "enter:b",
    ]);
    expect(mgr.isActive("a")).toBe(false);
    expect(mgr.isActive("b")).toBe(true);
  });

  it("update forwards dt to every active scene", () => {
    const stage = makeStage();
    const events: Event[] = [];
    const mgr = new SceneManager(stage);
    mgr.register({ key: "a", factory: (s, k) => new TestScene(s, k, events) });
    mgr.register({ key: "b", factory: (s, k) => new TestScene(s, k, events) });
    mgr.start("a");
    mgr.start("b");
    mgr.update(16);
    const updates = events.filter((e) => e.kind === "update");
    expect(updates.map((u) => u.kind === "update" ? u.key : "")).toEqual(["a", "b"]);
    expect(updates.every((u) => u.kind === "update" && u.dt === 16)).toBe(true);
  });

  it("starting a scene that is already active restarts it (exit then enter)", () => {
    const stage = makeStage();
    const events: Event[] = [];
    const mgr = new SceneManager(stage);
    mgr.register({ key: "a", factory: (s, k) => new TestScene(s, k, events) });
    mgr.start("a", { phase: 1 });
    mgr.start("a", { phase: 2 });
    const trail = events.map((e) => formatEvent(e));
    expect(trail).toEqual(["enter:a:1", "exit:a", "enter:a:2"]);
  });

  it("registered depth is applied before enter", () => {
    const stage = makeStage();
    const events: Event[] = [];
    const mgr = new SceneManager(stage);
    mgr.register({
      key: "a",
      factory: (s, k) => new TestScene(s, k, events),
      depth: 500,
    });
    const scene = mgr.start("a");
    expect(scene.active).toBe(true);
    // Walk the stage children to find the scene's root container.
    const sceneRoot = stage.root.children.find((c) => c.name === "r3:scene:a");
    expect(sceneRoot?.depth).toBe(500);
  });
});
