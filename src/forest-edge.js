import { forestRetreat } from "./scenery-motion.js";
export const BASE_FOREST_EDGE = -2.6 - forestRetreat(1);
export function meadowCoverage(z, edge = BASE_FOREST_EDGE) {
  const t = Math.max(0, Math.min(1, (z - (edge - 2.5)) / 3.7));
  return t * t * (3 - 2 * t);
}
export function meadowDepth(z, zoom) {
  const follow = Math.max(0, Math.min(1, (-2.6 - z) / (-2.6 - (BASE_FOREST_EDGE + 1.2))));
  return z - (forestRetreat(zoom) - forestRetreat(1)) * follow;
}
