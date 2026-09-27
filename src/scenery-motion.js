export function sceneryParallax(z) {
  return Math.max(0.055, Math.min(1.6, z <= -2.6 ? 0.65 * Math.exp((z + 2.6) * 0.26) : Math.exp(z * (-Math.log(0.65) / 2.6))));
}
export function forestRetreat(zoom = 1) {
  const pitchSin = 2.15 / Math.hypot(15, 2.15);
  return 0.1 * 4.5 * zoom / pitchSin;
}
export const sceneryParallaxGLSL = `
float groundSpeedAtDepth(float z){
  return clamp(z <= -2.6 ? .65*exp((z+2.6)*.26) : exp(z*(-log(.65)/2.6)), .055, 1.6);
}
`;
