/** @file Small deterministic viscoelastic lattice; caller supplies time, grab coordinates, and material coefficients. */
/**
 * Dimensionless 0..1 tuning coefficients for the solver's look, not measured material properties:
 * none of them is a density, a modulus, a Pa*s viscosity, or any other physical quantity, and they
 * carry no unit. Each field is read once by `createViscousLattice`, clamped to 0..1 (a non-finite
 * value becomes 0), and copied into the solver, so mutating the object afterwards changes nothing.
 * Values outside 0..1 are not an error; they saturate at the nearest bound.
 */
export type LatticeMaterial = {
  /**
   * How readily the volume yields, 0 = firm, 1 = slack. It is the only coefficient that acts on
   * four terms at once: it *reduces* the per-node restoring stiffness (`(1 - softness) * 28`) and
   * the neighbor-to-neighbor coupling stiffness (`12 + (1 - softness) * 30`), while it *increases*
   * the velocity a `pulse` injects (`strength * (0.5 + softness)`) and the strength with which a
   * held grab pulls nodes to the drag target (`70 + softness * 80`). Raising softness therefore
   * makes the volume both looser and more reactive to input, not merely weaker.
   */
  readonly softness: number;
  /**
   * Resistance to motion, 0 = freely oscillating, 1 = sluggish. It feeds two damping terms: the
   * absolute per-node velocity drag (`damping = 3 + viscosity * 25 + stickiness * 3`, opposing each
   * node's own velocity) and the relative damping between neighboring nodes
   * (`(velocity[b] - velocity[a]) * viscosity * 6`, which resists shear between adjacent nodes).
   * It is the dominant contributor to how fast a wobble dies out; it does not change the rest shape.
   */
  readonly viscosity: number;
  /**
   * Strength of the pull back to the undeformed shape, 0 = weak, 1 = strong. It appears only in the
   * per-node restoring stiffness (`restSpring = 18 + elasticity * 65 + (1 - softness) * 28`), the
   * spring term driving each node toward zero displacement. Higher elasticity means a stiffer,
   * faster snap back and a higher oscillation frequency; it does not set a bounce or restitution
   * ratio, and it has no effect while a grab holds a node at its target.
   */
  readonly elasticity: number;
  /**
   * How long the deformation clings after `release`, 0 = lets go at once, 1 = lets go slowly. It
   * sets the exponential time constant of the released grab adhesion
   * (`adhesion *= Math.exp(-dt / (0.025 + stickiness * 0.35))`), spanning 0.025 s at 0 to 0.375 s at
   * 1, during which the drag target keeps pulling with fading force. It also adds a small amount of
   * absolute velocity damping (`stickiness * 3`, against viscosity's `* 25`). It models no adhesion
   * to another body: nothing here couples the lattice to an external surface.
   */
  readonly stickiness: number;
};
/**
 * A point in the lattice's normalized model box as a readonly `[x, y, z]` tuple, where each axis
 * spans -0.5 (one face) to +0.5 (the opposite face) regardless of the real model's size, so the
 * consumer scales by its own bounding box. Also used for a displacement delta in `drag`, where the
 * same -0.5..0.5 units apply but the tuple is an offset rather than a position.
 */
export type Point3 = readonly [number, number, number];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

/**
 * Creates a 27-node (3x3x3) spring-and-damper volume with no renderer, browser, or clock
 * dependency: it never reads a global clock, `document`, `window`, or three.js, and holds no
 * geometry. Each call returns an independent simulation with its own state.
 *
 * Positions and displacements are in the normalized model box: each axis spans -0.5..0.5, so the
 * consumer maps them onto its own mesh. Every point taken in is clamped into that box per axis, so
 * a point outside it is treated as the nearest point on the box surface (see `grab` and `sample`).
 *
 * Time is caller-supplied: `step(seconds)` advances at most 1/15 s per call in substeps of at most
 * 1/120 s, discarding any excess, so a long stall cannot explode the integration. Non-finite inputs
 * become 0 everywhere; coefficients are clamped to 0..1, the drag target to +/-0.4 per axis,
 * velocity to +/-3 per axis, and displacement to +/-0.45 per axis.
 *
 * This is a visual deformation model. It has no collision, contact, support surface, gravity, or
 * volume conservation; a deformed volume may interpenetrate anything, and holding it deformed costs
 * nothing. Those belong to the consumer.
 */
export function createViscousLattice(material: LatticeMaterial) {
  const displacement = new Float64Array(81);
  const velocity = new Float64Array(81);
  const forces = new Float64Array(81);
  const weights = new Float64Array(27);
  const softness = clamp(material.softness, 0, 1);
  const viscosity = clamp(material.viscosity, 0, 1);
  const elasticity = clamp(material.elasticity, 0, 1);
  const stickiness = clamp(material.stickiness, 0, 1);
  const restSpring = 18 + elasticity * 65 + (1 - softness) * 28;
  const damping = 3 + viscosity * 25 + stickiness * 3;
  const state: { held: boolean; adhesion: number; target: number[] } = { held: false, adhesion: 0, target: [0, 0, 0] };
  const neighbors: [number, number][] = [];
  for (let z = 0; z < 3; z += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const index = x + y * 3 + z * 9;
        if (x < 2) { neighbors.push([index, index + 1]); }
        if (y < 2) { neighbors.push([index, index + 3]); }
        if (z < 2) { neighbors.push([index, index + 9]); }
      }
    }
  }
  return {
    /**
     * Starts holding the volume at `point`, and resets the drag target to zero so the next `drag`
     * is measured from here. Sets `held` to true and adhesion to full strength at once.
     *
     * Each of the 27 nodes receives a Gaussian influence weight `exp(-d^2 * 5)` from its distance
     * `d` to the grab point, so the nearest nodes follow the drag almost fully and distant ones only
     * partly; the grab is a soft region of influence, not the selection of one node.
     *
     * `point` is clamped per axis to -0.5..0.5, so a point outside the model box grabs as if it were
     * on the nearest box surface: the clamp is applied to each axis independently, so a point beyond
     * a corner maps to that corner and not to a projection along the direction to the center. A
     * non-finite coordinate becomes 0, the box center on that axis. Calling `grab` again re-centers
     * the influence weights and zeroes the drag target, discarding the previous drag.
     */
    grab(point: Point3) {
      state.held = true; state.adhesion = 1; state.target.fill(0);
      for (let index = 0; index < 27; index += 1) {
        const dx = index % 3 / 2 - .5 - clamp(point[0], -.5, .5);
        const dy = Math.floor(index / 3) % 3 / 2 - .5 - clamp(point[1], -.5, .5);
        const dz = Math.floor(index / 9) / 2 - .5 - clamp(point[2], -.5, .5);
        weights[index] = Math.exp(-(dx * dx + dy * dy + dz * dz) * 5);
      }
    },
    /**
     * Sets where the grab is pulling to, as the *total* offset from the point given to `grab`, not
     * an increment: passing the same delta twice does not pull twice as far, and the consumer
     * forwards an accumulated pointer offset rather than a per-frame movement.
     *
     * Each axis is clamped to -0.4..0.4 in normalized box units; a non-finite component becomes 0.
     * This bound is the reach of the pull, distinct from the -0.5..0.5 box that positions use and
     * from the +/-0.45 hard bound on the resulting displacement.
     *
     * The delta is the target for a node at the grab center only. Every node is pulled toward the
     * delta scaled by its own grab influence weight, so the volume stretches rather than translating
     * rigidly, and no node reaches the full delta unless it sits exactly at the grab point. Nothing
     * moves until `step` runs, and the pull decays after `release` rather than stopping instantly.
     */
    drag(delta: Point3) { for (let axis = 0; axis < 3; axis += 1) { state.target[axis] = clamp(delta[axis] ?? 0, -.4, .4); } },
    /**
     * Stops holding the volume, setting `held` to false at once. It does not snap the shape back and
     * does not clear the drag target: the pull decays over the following `step` calls as adhesion
     * falls exponentially with the time constant `stickiness` sets (0.025 s at 0 to 0.375 s at 1),
     * and is cut off entirely once adhesion drops below 0.0001. Only then do the restoring springs
     * carry the volume back to its rest shape on their own. Calling it while not held has no effect.
     */
    release() { state.held = false; },
    /**
     * Injects a one-shot velocity impulse into every node, used for a tap or an impact. `strength`
     * is clamped to 0..1 and scaled by softness into `strength * (0.5 + softness)`, so a softer
     * material wobbles further from the same call; it is added to the current velocities rather than
     * replacing them, and repeated calls accumulate (subject to the +/-3 per-axis velocity bound).
     *
     * The direction is not uniformly radial. On X and Z each node is pushed outward from the box
     * center, proportionally to its own signed offset, so the middle plane of each of those axes
     * receives nothing and the outer faces receive the most. On Y the push is downward everywhere
     * and never upward: it scales with height above the bottom face, being 0 at the bottom layer,
     * -0.5x the impulse at the middle layer and -1x at the top layer. The net effect is a squash --
     * the volume spreads sideways while its top is driven down toward its base.
     */
    pulse(strength: number) {
      const impulse = clamp(strength, 0, 1) * (.5 + softness);
      for (let index = 0; index < 27; index += 1) {
        const x = index % 3 / 2 - .5;
        const y = Math.floor(index / 3) % 3 / 2 - .5;
        const z = Math.floor(index / 9) / 2 - .5;
        velocity[index * 3] = (velocity[index * 3] ?? 0) + x * impulse;
        velocity[index * 3 + 1] = (velocity[index * 3 + 1] ?? 0) - (y + .5) * impulse;
        velocity[index * 3 + 2] = (velocity[index * 3 + 2] ?? 0) + z * impulse;
      }
    },
    /**
     * Advances the simulation by `seconds` of elapsed time. The unit is seconds, not milliseconds:
     * a 60 fps consumer passes 1/60, and passing a millisecond delta would over-advance by a
     * thousandfold were it not capped.
     *
     * `seconds` is clamped to 0..1/15, so a single call advances at most 1/15 s and any excess is
     * discarded rather than accumulated -- after a long stall the volume resumes from where it was
     * instead of catching up. A negative or non-finite value clamps to 0 and advances nothing. The
     * clamped interval is subdivided into equal substeps of at most 1/120 s for stability, so the
     * result depends on the elapsed time rather than on how many calls delivered it.
     *
     * This is the only method that changes the shape: `grab`, `drag`, `pulse` and `release` only set
     * up state that the next `step` integrates.
     */
    step(seconds: number) {
      const elapsed = clamp(seconds, 0, 1 / 15);
      const steps = Math.max(1, Math.ceil(elapsed * 120));
      const dt = elapsed / steps;
      for (let step = 0; step < steps; step += 1) {
        if (!state.held) { state.adhesion *= Math.exp(-dt / (.025 + stickiness * .35)); }
        for (let offset = 0; offset < 81; offset += 1) {
          forces[offset] = -(displacement[offset] ?? 0) * restSpring - (velocity[offset] ?? 0) * damping;
        }
        for (const [first, second] of neighbors) {
          for (let axis = 0; axis < 3; axis += 1) {
            const a = first * 3 + axis; const b = second * 3 + axis;
            const force = ((displacement[b] ?? 0) - (displacement[a] ?? 0)) * (12 + (1 - softness) * 30)
              + ((velocity[b] ?? 0) - (velocity[a] ?? 0)) * viscosity * 6;
            forces[a] = (forces[a] ?? 0) + force; forces[b] = (forces[b] ?? 0) - force;
          }
        }
        for (let offset = 0; offset < 81; offset += 1) {
          const distance = (state.target[offset % 3] ?? 0) * (weights[Math.floor(offset / 3)] ?? 0) - (displacement[offset] ?? 0);
          const adhesionForce = distance * (70 + softness * 80) * state.adhesion;
          const grab = state.adhesion > .0001 ? adhesionForce : 0;
          velocity[offset] = clamp((velocity[offset] ?? 0) + ((forces[offset] ?? 0) + grab) * dt, -3, 3);
          displacement[offset] = clamp((displacement[offset] ?? 0) + (velocity[offset] ?? 0) * dt, -.45, .45);
        }
      }
    },
    /**
     * Reads the current displacement at `point`, trilinearly interpolated from the eight lattice
     * nodes around it, and writes it into `output[0]`, `output[1]` and `output[2]` as x, y, z. The
     * caller owns `output` and it is overwritten in full, never read; passing one reusable array
     * avoids allocating per vertex in a per-frame loop over a mesh.
     *
     * Both `point` and the result are in normalized box units (-0.5..0.5 per axis), and the result
     * is an offset to add to the vertex, not a new position -- the consumer scales it by its own
     * bounding box and adds it to the undeformed vertex.
     *
     * `point` is clamped per axis into the box, so sampling outside the model box returns the
     * displacement of the nearest point on its surface rather than extrapolating or returning zero,
     * and every point beyond a face shares that face's value. A non-finite coordinate becomes 0, the
     * center on that axis. Sampling does not advance or otherwise alter the simulation.
     */
    sample(point: Point3, output: number[]) {
      const px = clamp((point[0] + .5) * 2, 0, 2);
      const py = clamp((point[1] + .5) * 2, 0, 2);
      const pz = clamp((point[2] + .5) * 2, 0, 2);
      const cx = Math.min(1, Math.floor(px)); const cy = Math.min(1, Math.floor(py)); const cz = Math.min(1, Math.floor(pz));
      const dx = px - cx; const dy = py - cy; const dz = pz - cz;
      output[0] = 0; output[1] = 0; output[2] = 0;
      for (let z = 0; z < 2; z += 1) {
        for (let y = 0; y < 2; y += 1) {
          for (let x = 0; x < 2; x += 1) {
            const weight = (x ? dx : 1 - dx) * (y ? dy : 1 - dy) * (z ? dz : 1 - dz);
            const index = cx + x + (cy + y) * 3 + (cz + z) * 9;
            for (let axis = 0; axis < 3; axis += 1) { output[axis] = (output[axis] ?? 0) + (displacement[index * 3 + axis] ?? 0) * weight; }
          }
        }
      }
    },
    /**
     * Whether a grab is currently holding the volume: true from `grab` until `release`. It reports
     * pointer ownership only, so it turns false the instant `release` is called even though the
     * adhesion is still fading and the shape is still deformed. It is not a "still moving" flag --
     * use `maxDisplacement` to tell whether the volume has settled.
     */
    get held() { return state.held; },
    /**
     * The largest absolute single-axis displacement currently present among the 27 lattice nodes,
     * in normalized model-box units where each axis spans -0.5..0.5. It is the maximum over all 81
     * signed components (27 nodes x 3 axes) of that component's absolute value.
     *
     * Precisely, and in contrast with readings this name invites:
     * - It is a per-axis maximum, *not* a Euclidean vector length. A node displaced by
     *   (0.3, 0.4, 0) contributes 0.4, not 0.5, so the value is a lower bound on the greatest
     *   distance any node has actually travelled.
     * - It is the *current* state, recomputed on every read, *not* a historical peak: it rises under
     *   a grab and falls back toward 0 as the volume recovers after `release`.
     * - It is a *measurement* of the simulation, *not* a configured limit or a value the caller can
     *   set. The configured bound is the fixed +/-0.45 per-axis clamp, which this value approaches
     *   only under an extreme grab.
     * - It is read at the 27 lattice *nodes*, *not* at the consumer's mesh vertices. An interpolated
     *   `sample` between nodes can never exceed it, so a vertex-level maximum measured by the
     *   consumer -- especially one scaled by a real bounding box or taken as a Euclidean distance --
     *   is a different quantity in different units.
     *
     * It is 0 exactly when the volume is at its rest shape, which makes it the value to test against
     * a small threshold to detect that recovery has finished.
     */
    get maxDisplacement() { return Math.max(...displacement.map(Math.abs)); },
  };
}
/**
 * One simulation instance, the object `createViscousLattice` returns: the methods `grab`, `drag`,
 * `release`, `pulse`, `step` and `sample`, plus the read-only `held` and `maxDisplacement`. It is
 * mutable, stateful and not a value type, so it is stored and reused rather than recreated per
 * frame, and it is written for the consumer to hold one instance per deformable body.
 */
export type ViscousLattice = ReturnType<typeof createViscousLattice>;
