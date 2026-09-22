/** @file Physical behavior: drag, recovery, viscosity contrast, and bounded time/force inputs. */
import { createViscousLattice } from "./viscous-lattice.ts";
const material = { softness: .7, elasticity: .6, stickiness: .2, viscosity: .3 };
it("grab distorts the volume and release converges to its rest shape", () => {
  const lattice = createViscousLattice(material);
  lattice.grab([0, .5, 0]); lattice.drag([.3, -.2, .1]);
  for (let frame = 0; frame < 60; frame += 1) { lattice.step(1 / 60); }
  expect(lattice.maxDisplacement).toBeGreaterThan(.06);
  const sample = [0, 0, 0]; lattice.sample([0, .5, 0], sample);
  expect(sample[0]).toBeGreaterThan(.06);
  lattice.release();
  for (let frame = 0; frame < 480; frame += 1) { lattice.step(1 / 60); }
  expect(lattice.maxDisplacement).toBeLessThan(.0001);
});
it("high viscosity damps the same impulse more strongly without instability", () => {
  const low = createViscousLattice({ ...material, viscosity: 0 });
  const high = createViscousLattice({ ...material, viscosity: 1 });
  low.pulse(1); high.pulse(1);
  for (let frame = 0; frame < 12; frame += 1) { low.step(1 / 60); high.step(1 / 60); }
  expect(high.maxDisplacement).toBeLessThan(low.maxDisplacement * .5);
  high.grab([1e9, -1e9, 0]); high.drag([1e9, -1e9, 1e9]);
  for (let frame = 0; frame < 100; frame += 1) { high.step(1000); }
  expect(Number.isFinite(high.maxDisplacement)).toBe(true);
  expect(high.maxDisplacement).toBeLessThanOrEqual(.45);
});

it("drops excess frame time and ignores non-finite input without corrupting samples", () => {
  const long = createViscousLattice(material);
  const bounded = createViscousLattice(material);
  long.pulse(1); bounded.pulse(1);
  long.step(1000); bounded.step(1 / 15);
  expect(long.maxDisplacement).toBe(bounded.maxDisplacement);
  const previous = long.maxDisplacement;
  long.step(Number.NaN); long.step(-1); long.step(Number.POSITIVE_INFINITY);
  expect(long.maxDisplacement).toBe(previous);
  const invalid = createViscousLattice({ softness: Number.NaN,viscosity: Number.POSITIVE_INFINITY,elasticity: -5,stickiness: 100 });
  invalid.grab([Number.NaN,Number.POSITIVE_INFINITY,0]);
  invalid.drag([Number.NaN,Number.POSITIVE_INFINITY,0]); invalid.step(1 / 60);
  const output = [1,1,1]; invalid.sample([Number.NaN,0,0],output);
  expect(output).toEqual([0,0,0]);
});
