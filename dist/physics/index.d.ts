/**
 * @file Public entry of the dependency-free visual physics kernels, published as the package
 * subpath `@trkbt10/r3/physics`. Nothing here imports three.js, a renderer, a browser global, or a
 * clock, so it runs unchanged in a plain Node.js process and in a browser bundle.
 */
export { createViscousLattice } from './viscous-lattice.ts';
export type { LatticeMaterial, Point3, ViscousLattice } from './viscous-lattice.ts';
