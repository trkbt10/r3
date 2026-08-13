// @vitest-environment happy-dom
/**
 * @file R3Image — pivot / auto-hit-area alignment.
 *
 * Mirror of `Rect.spec.ts` for the textured-plane leaf. Same bug,
 * same fix (`computeAutoHitArea`). We duplicate the coverage rather
 * than parameterising both leaves through a single harness because
 * each class has its own constructor + source semantics; a shared
 * harness would need to bridge `{width, height, interactive}` onto
 * `{source, width, height, interactive}` and obscure what each leaf
 * actually does on construction.
 *
 * The DOM (`happy-dom`) is required because `R3Image` builds a
 * `CanvasTexture` from a host `<canvas>`.
 */

import { BufferGeometry, Mesh, MeshBasicMaterial, Texture } from "three";
import { R3Image, textureLowerFadeUniforms } from "./Image.ts";
import { Stage } from "./Stage.ts";
import { defaultTextureManager } from "./texture-canvas";

function makeStage(): Stage {
  return new Stage({
    screen: { width: 1280, height: 720 },
    textureManager: defaultTextureManager,
  });
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe("R3Image auto hit-area vs pivot", () => {
  it("hit area coincides with the visible mesh at top-left pivot", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(120, 80) },
      width: 120,
      height: 80,
      originX: 0,
      originY: 0,
      interactive: true,
    });
    expect(image.hitArea).toStrictEqual({ x: 0, y: 0, width: 120, height: 80 });
  });

  it("hit area coincides with the visible mesh at centre pivot", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(120, 80) },
      width: 120,
      height: 80,
      originX: 0.5,
      originY: 0.5,
      interactive: true,
    });
    expect(image.hitArea).toStrictEqual({
      x: -60,
      y: -40,
      width: 120,
      height: 80,
    });
  });

  it("hit area coincides with the visible mesh at bottom-right pivot", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(120, 80) },
      width: 120,
      height: 80,
      originX: 1,
      originY: 1,
      interactive: true,
    });
    expect(image.hitArea).toStrictEqual({
      x: -120,
      y: -80,
      width: 120,
      height: 80,
    });
  });

  it("recomputes hit area when setSize runs while interactive", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(100, 100) },
      width: 100,
      height: 100,
      originX: 0.5,
      originY: 0.5,
      interactive: true,
    });
    image.setSize(200, 50);
    expect(image.hitArea).toStrictEqual({
      x: -100,
      y: -25,
      width: 200,
      height: 50,
    });
  });

  it("leaves hitArea null on non-interactive Image, even across setSize", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(80, 80) },
      width: 80,
      height: 80,
    });
    expect(image.hitArea).toBeNull();
    image.setSize(40, 40);
    expect(image.hitArea).toBeNull();
  });

  it("honours an explicit setInteractive(rect) override", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(100, 100) },
      width: 100,
      height: 100,
      originX: 0.5,
      originY: 0.5,
      interactive: true,
    });
    image.setInteractive({ x: -70, y: -70, width: 140, height: 140 });
    expect(image.hitArea).toStrictEqual({
      x: -70,
      y: -70,
      width: 140,
      height: 140,
    });
  });
});

describe("R3Image pointer alignment (behavioural)", () => {
  function assertVisibleImagePickable(
    pivotX: number,
    pivotY: number,
    width: number,
    height: number,
  ): void {
    const stage = makeStage();
    const cx = 500;
    const cy = 360;
    const image = new R3Image({
      textureManager: defaultTextureManager,
      x: cx,
      y: cy,
      source: { kind: "canvas", canvas: makeCanvas(width, height) },
      width,
      height,
      originX: pivotX,
      originY: pivotY,
      interactive: true,
    });
    stage.add(image);
    stage.composeFrame();

    const visibleLeft = cx - pivotX * width;
    const visibleTop = cy - pivotY * height;
    const visibleRight = visibleLeft + width;
    const visibleBottom = visibleTop + height;

    const inside: Array<[number, number, string]> = [
      [visibleLeft + 1, visibleTop + 1, "inside top-left"],
      [visibleRight - 1, visibleTop + 1, "inside top-right"],
      [visibleLeft + 1, visibleBottom - 1, "inside bottom-left"],
      [visibleRight - 1, visibleBottom - 1, "inside bottom-right"],
    ];
    const outside: Array<[number, number, string]> = [
      [visibleLeft - 2, visibleTop + 10, "2px left of left edge"],
      [visibleRight + 2, visibleTop + 10, "2px right of right edge"],
      [visibleLeft + 10, visibleTop - 2, "2px above top edge"],
      [visibleLeft + 10, visibleBottom + 2, "2px below bottom edge"],
    ];

    for (const [px, py, label] of inside) {
      const hit = stage.pointer.pickAt(px, py);
      expect(
        hit,
        `pivot=(${String(pivotX)},${String(pivotY)}) ${label} should hit`,
      ).toBe(image);
    }
    for (const [px, py, label] of outside) {
      const hit = stage.pointer.pickAt(px, py);
      expect(
        hit,
        `pivot=(${String(pivotX)},${String(pivotY)}) ${label} should miss`,
      ).toBeNull();
    }
  }

  it("picks inside and misses outside for top-left pivot", () => {
    assertVisibleImagePickable(0, 0, 120, 80);
  });

  it("picks inside and misses outside for centre pivot", () => {
    assertVisibleImagePickable(0.5, 0.5, 120, 80);
  });

  it("picks inside and misses outside for bottom-right pivot", () => {
    assertVisibleImagePickable(1, 1, 120, 80);
  });

  it("picks correctly for asymmetric fractional pivots", () => {
    assertVisibleImagePickable(0.25, 0.75, 200, 100);
  });
});

describe("R3Image owned canvas lifecycle", () => {
  it("releases explicitly owned canvas backing stores on destroy", () => {
    const canvas = makeCanvas(64, 32);
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas },
      releaseCanvasOnDestroy: true,
    });

    image.destroy();

    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("does not release shared canvas sources by default", () => {
    const canvas = makeCanvas(64, 32);
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas },
    });

    image.destroy();

    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(32);
  });

  it("releases the previous owned canvas when replacing a canvas source", () => {
    const first = makeCanvas(64, 32);
    const second = makeCanvas(16, 8);
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: first },
      releaseCanvasOnDestroy: true,
    });

    image.replaceCanvasSource(second);

    expect(first.width).toBe(0);
    expect(first.height).toBe(0);

    image.destroy();

    expect(second.width).toBe(0);
    expect(second.height).toBe(0);
  });

  it("detaches the old texture before disposing it during replacement", () => {
    const first = document.createElement("img");
    const second = document.createElement("img");
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "element", element: first },
    });
    const previous = imageTextureForTest(image);
    const seenDisposedWhileMapped = { value: false };
    previous.addEventListener("dispose", () => {
      seenDisposedWhileMapped.value = imageMaterialForTest(image).map === previous;
    });

    image.replaceElementSource(second);

    expect(seenDisposedWhileMapped.value).toBe(false);
    expect(imageMaterialForTest(image).map).not.toBe(previous);
  });

  it("can replace an element texture without changing display size", () => {
    const first = document.createElement("img");
    const second = document.createElement("img");
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "element", element: first },
      width: 120,
      height: 80,
    });

    image.replaceElementSource(second);

    expect(image.width).toBe(120);
    expect(image.height).toBe(80);
  });

  it("owns textures created after replacing a borrowed texture source", () => {
    const borrowed = new Texture(makeCanvas(8, 8));
    const nextImage = document.createElement("img");
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "texture", texture: borrowed },
    });

    image.replaceElementSource(nextImage);
    const replaced = imageTextureForTest(image);
    const disposed = { value: false };
    replaced.addEventListener("dispose", () => {
      disposed.value = true;
    });

    image.destroy();

    expect(disposed.value).toBe(true);
  });
});

function imageTextureForTest(image: R3Image): Texture {
  return imageMeshForTest(image).material.map ?? missingImageProbe("texture");
}

function imageMaterialForTest(image: R3Image): MeshBasicMaterial {
  return imageMeshForTest(image).material;
}

describe("R3Image texture crop", () => {
  it("maps a top-left normalized source rect onto the plane UVs without allocating another canvas", () => {
    const source = makeCanvas(900, 1500);
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: source },
      textureCrop: { x: 0, y: 0, width: 1, height: 0.46 },
    });

    expect(readImageUvs(image)).toEqual([
      0,
      1,
      1,
      1,
      0,
      0.54,
      1,
      0.54,
    ]);
    expect(source.width).toBe(900);
    expect(source.height).toBe(1500);
  });

  it("updates the same geometry when the crop changes", () => {
    const image = new R3Image({
      textureManager: defaultTextureManager,
      source: { kind: "canvas", canvas: makeCanvas(900, 1500) },
    });

    image.setTextureCrop({ x: 0.1, y: 0.2, width: 0.5, height: 0.25 });

    expect(readImageUvs(image)).toEqual([
      0.1,
      0.8,
      0.6,
      0.8,
      0.1,
      0.55,
      0.6,
      0.55,
    ]);
  });

  it("computes lower fade uniforms inside the cropped UV range", () => {
    const uniforms = textureLowerFadeUniforms(
      { x: 0, y: 0, width: 1, height: 0.62 },
      { startY: 0.76 },
    );

    expect(uniforms.startV).toBeCloseTo(0.5288);
    expect(uniforms.endV).toBeCloseTo(0.38);
  });
});

function readImageUvs(image: R3Image): number[] {
  const { geometry } = imageMeshForTest(image);
  const uv = geometry.attributes.uv;
  if (uv === undefined) {
    throw new Error("R3Image uv probe is out of sync with R3Image internals");
  }
  return Array.from(uv.array, (value) => Number(value.toFixed(4)));
}

function imageMeshForTest(image: R3Image): Mesh<BufferGeometry, MeshBasicMaterial> {
  const mesh = image.obj3d.children[0];
  if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshBasicMaterial)) {
    throw new Error("R3Image mesh probe is out of sync with R3Image internals");
  }
  return mesh;
}

function missingImageProbe(name: string): never {
  throw new Error(`R3Image ${name} probe is out of sync with R3Image internals`);
}
