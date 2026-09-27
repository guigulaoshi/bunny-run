const VIEW_SLOPE = 2.15 / 15;
const VIEW_COS = 1 / Math.sqrt(1 + VIEW_SLOPE ** 2);
const raisedSunY = 8 + 0.2 * ((1.3 + 2.7 / VIEW_COS) / 0.3 - (8 + 12 * VIEW_SLOPE));
export const SUN = { x: 0, y: raisedSunY, z: -12 };
export const SUN_SHADOW = { x: -SUN.x / SUN.y, z: -SUN.z / SUN.y };
export function sunBillboardPosition(zoom = 1) {
  const slope = 2.15 / 15, cos = 1 / Math.sqrt(1 + slope * slope), sin = slope * cos;
  const z = -33, distance = 0.3 * zoom;
  const projectedY = (SUN.y * cos - SUN.z * sin) * distance;
  return { x: 5 * (zoom - 1) + SUN.x * distance, y: (projectedY + sin * z) / cos, z };
}
