export function createEarChain() {
  return Array.from({ length: 6 }, () => ({ x: 0, z: 0, vx: 0, vz: 0 }));
}
export function stepEarChain(chain, sideDrive, fallDrive, dt) {
  const steps = Math.max(1, Math.ceil(dt / 8e-3)), h = dt / steps;
  for (let k = 0; k < steps; k++) {
    const previous = chain.map((s) => ({ ...s }));
    chain.forEach((s, i) => {
      const parent = previous[i - 1];
      const tx = i ? parent.x + sideDrive * 0.18 : sideDrive * 0.35;
      const tz = i ? parent.z + fallDrive * 0.24 : fallDrive * 0.4;
      for (const [axis, vel, target] of [["x", "vx", tx], ["z", "vz", tz]]) {
        s[vel] += (75 * (target - s[axis]) - 6 * s[vel]) * h;
        s[axis] = Math.max(-2.5, Math.min(2.5, s[axis] + s[vel] * h));
      }
    });
  }
}
export function earCurve(chain, length) {
  const nodes = [{ x: 0, y: 0, z: 0, ax: 0, az: 0 }];
  for (const s of chain) {
    const theta = Math.min(2.5, Math.hypot(s.x, s.z)), norm = Math.hypot(s.x, s.z) || 1, prev = nodes.at(-1), step = length / chain.length;
    nodes.push({ x: prev.x + Math.sin(theta) * s.x / norm * step, y: prev.y + Math.cos(theta) * step, z: prev.z + Math.sin(theta) * s.z / norm * step, ax: s.x, az: s.z });
  }
  return nodes;
}
